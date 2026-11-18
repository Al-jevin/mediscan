import { Platform } from 'react-native';
import type { MedicineInfoRow } from '@/components/MedicineInfoCard';
import { Assets } from '@/constants/assets';
import type { ScanResult } from '@/data/mockScanResults';
import type { FdaMedicine } from '@/types/medicine';
import { API_V1_URL } from '@/services/apiUrl';

// Shape of POST /api/v1/ocr/extract-label (back-end/app/schemas/ocr.py). Only the fields the app reads.
type OcrMedicine = FdaMedicine & {
  confidence_percentage: number;
  trust_score?: number | null;
  trust_tier?: 'high' | 'medium' | 'low' | null;
};
type OcrEntities = {
  medicine_name: string | null;
  dosage: string | null;
  frequency: string | null;
  expiry_date: string | null;
};

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type ScanTelemetry = {
  stage?: 0 | 1 | 2 | null;
  raw_ocr_text?: string;
  grounded_text?: string;
  trust_score?: number | null;
  confidence_tier?: 'high' | 'medium' | 'low' | null;
  trust_tier?: 'high' | 'medium' | 'low' | null;
  dosage_match_status?: string | null;
  safety_cap_reason?: string | null;
  applied_preprocessing?: string[] | null;
  quarantined_distractors?: string[] | null;
  primary_header_lines?: string[] | null;
  secondary_body_lines?: string[] | null;
  clahe_applied?: boolean | null;
  roi_fallback_used?: boolean | null;
  ocr_confidence?: number | null;
  dosage_confidence?: number | null;
  fda_match_score?: number | null;
  preprocess_ms?: number | null;
  ocr_ms?: number | null;
  nlp_ms?: number | null;
  grounding_ms?: number | null;
  db_match_ms?: number | null;
  total_ms?: number | null;
  total_latency_ms?: number | null;
  latency_ms?: {
    preprocess_ms?: number | null;
    ocr_ms?: number | null;
    nlp_ms?: number | null;
    db_match_ms?: number | null;
    total_ms?: number | null;
  } | null;
};

export type ScanSnapshot = {
  result: ScanResult;
  telemetry: ScanTelemetry;
};

type OcrResponse = {
  entities: OcrEntities;
  suggested_medicines: OcrMedicine[];
  trust_score?: number | null;
  confidence_tier?: 'high' | 'medium' | 'low' | null;
  dosage_match_status?: string | null;
  safety_cap_reason?: string | null;
  telemetry?: ScanTelemetry;
};

const REQUEST_TIMEOUT_MS = 90_000; // PaddleOCR on a CPU can take a while

const VERIFIED_MIN_CONFIDENCE = 90;
const NEEDS_VERIFICATION_MIN_CONFIDENCE = 65;
const MAX_POSSIBLE_MATCHES = 4;

let latestScan: ScanResult | null = null;
let latestScanTelemetry: ScanTelemetry | null = null;
let latestScanId: string | null = null;
let nextScanId = 0;
const scanSnapshots = new Map<string, ScanSnapshot>();
export const getLatestScan = () => latestScan;
export const getLatestScanTelemetry = () => latestScanTelemetry;
export const getLatestScanId = () => latestScanId;
export const getScanSnapshot = (scanId: string) => scanSnapshots.get(scanId) ?? null;

export function getConfidenceTier(telemetry: ScanTelemetry): ConfidenceTier | null {
  const dosageStatus = telemetry.dosage_match_status?.toLowerCase();
  if (dosageStatus === 'mismatch' || dosageStatus === 'dosage_conflict') return 'low';
  if (
    dosageStatus === 'not_detected' ||
    dosageStatus === 'missing_dosage' ||
    dosageStatus === 'unverified'
  ) {
    return 'medium';
  }

  const trustScore = telemetry.trust_score;
  if (typeof trustScore === 'number' && Number.isFinite(trustScore)) {
    if (trustScore >= 0.85) return 'high';
    if (trustScore >= 0.65) return 'medium';
    return 'low';
  }

  const reportedTier = telemetry.confidence_tier ?? telemetry.trust_tier;
  switch (reportedTier?.toLowerCase()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return null;
  }
}

function toInfoRows(rows: (MedicineInfoRow | false)[]): MedicineInfoRow[] {
  return rows.filter((row): row is MedicineInfoRow => row !== false);
}

function displayName(medicine: OcrMedicine): string {
  return [medicine.fda_brandname || medicine.fda_genericname, medicine.fda_dosage_strength].filter(Boolean).join(' ');
}

function toScanResult({ entities, suggested_medicines }: OcrResponse): ScanResult {
  const candidates = suggested_medicines.filter((m) => m.confidence_percentage >= NEEDS_VERIFICATION_MIN_CONFIDENCE);
  const best = candidates[0];
  const confidence = best?.confidence_percentage ?? 0;

  if (!best) {
    return {
      status: 'no_results',
      detected: toInfoRows([
        !!entities.medicine_name && { icon: Assets.icons.medicineType, label: 'Name', value: entities.medicine_name },
        !!entities.dosage && { icon: Assets.icons.strength, label: 'Dosage', value: entities.dosage },
        !!entities.expiry_date && { icon: Assets.icons.expiryDate, label: 'Expiry Date', value: entities.expiry_date },
      ]),
    };
  }

  const form = best.fda_dosage_form ?? '';
  const strength = best.fda_dosage_strength ?? '';

  if (confidence < VERIFIED_MIN_CONFIDENCE) {
    return {
      status: 'needs_verification',
      confidence,
      matches: candidates.slice(0, MAX_POSSIBLE_MATCHES).map((m) => ({
        id: m.fda_approval_id,
        name: displayName(m),
        category: m.fda_genericname,
        form: m.fda_dosage_form ?? '',
        strength: m.fda_dosage_strength ?? '',
        similarity: m.confidence_percentage,
        medicine: m,
      })),
    };
  }

  // The same product can be registered by several makers, so only name one when the matches agree.
  const manufacturerIsCertain = candidates.every(
    (m) => m.confidence_percentage < confidence || m.fda_manufacturer === best.fda_manufacturer,
  );

  return {
    status: 'verified',
    confidence,
    medicine: {
      name: displayName(best),
      category: best.fda_genericname,
      form,
      linkedMedicine: best,
    },
    info: toInfoRows([
      manufacturerIsCertain && !!best.fda_manufacturer && { icon: Assets.icons.manufacturer, label: 'Manufacturer', value: best.fda_manufacturer },
      { icon: Assets.icons.expiryDate, label: 'Expiry Date', value: entities.expiry_date ?? 'Not detected' },
      !!form && { icon: Assets.icons.medicineType, label: 'Medicine Type', value: form },
      !!strength && { icon: Assets.icons.strength, label: 'Strength', value: strength },
    ]),
  };
}

function toScanTelemetry(response: OcrResponse): ScanTelemetry {
  const telemetry = response.telemetry ?? {};
  const best = response.suggested_medicines[0];
  const trustScore =
    response.trust_score ?? telemetry.trust_score ?? best?.trust_score ?? null;
  const confidenceTier =
    response.confidence_tier ??
    telemetry.confidence_tier ??
    telemetry.trust_tier ??
    best?.trust_tier ??
    (trustScore === null
      ? null
      : trustScore >= 0.85
        ? 'high'
        : trustScore >= 0.65
          ? 'medium'
          : 'low');

  const mappedTelemetry: ScanTelemetry = {
    ...telemetry,
    trust_score: trustScore,
    confidence_tier: confidenceTier,
    trust_tier: telemetry.trust_tier ?? best?.trust_tier ?? confidenceTier,
    dosage_match_status:
      response.dosage_match_status ?? telemetry.dosage_match_status ?? null,
    safety_cap_reason:
      response.safety_cap_reason ?? telemetry.safety_cap_reason ?? null,
  };
  return {
    ...mappedTelemetry,
    confidence_tier: getConfidenceTier(mappedTelemetry),
  };
}

// Sends a local JPEG to the OCR + NER pipeline and returns the state for the Scan Result screen.
export async function scanLabel(imageUri: string): Promise<ScanResult> {
  if (!API_V1_URL) throw new Error('EXPO_PUBLIC_API_URL is not set (see front-end/.env)');

  const body = new FormData();
  if (Platform.OS === 'web') {
    const imageResponse = await fetch(imageUri);
    if (!imageResponse.ok) throw new Error('Could not read the selected image.');
    body.append('file', await imageResponse.blob(), 'medicine-label.jpg');
  } else {
    const { File } = await import('expo-file-system');
    body.append('file', new File(imageUri));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_V1_URL}/ocr/extract-label`, {
      method: 'POST',
      body,
      signal: controller.signal,
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        typeof responseBody?.detail === 'string'
          ? responseBody.detail
          : typeof responseBody?.message === 'string'
            ? responseBody.message
            : `The server returned an error (${response.status}).`;
      throw new Error(detail);
    }

    const ocrResponse = responseBody as OcrResponse;
    const result = toScanResult(ocrResponse);
    const telemetry = toScanTelemetry(ocrResponse);
    const scanId = `${Date.now()}-${++nextScanId}`;
    latestScan = result;
    latestScanTelemetry = telemetry;
    latestScanId = scanId;
    scanSnapshots.set(scanId, { result, telemetry });
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The scan request timed out. Try again with a smaller, clearer image.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
