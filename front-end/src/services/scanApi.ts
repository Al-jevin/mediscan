import { Platform } from 'react-native';
import type { MedicineInfoRow } from '@/components/MedicineInfoCard';
import { Assets } from '@/constants/assets';
import type { ScanResult } from '@/data/mockScanResults';
import { getApiV1Url } from '@/services/apiUrl';
import {
  getConfidenceTier,
  type ConfidenceTier,
} from '@/services/scanConfidence';
import { MockAuth } from '@/mock/mockAuth';
import type { FdaMedicine } from '@/types/medicine';

export type { ConfidenceTier };
export { getConfidenceTier };

// Shape of POST /api/v1/ocr/extract-label (back-end/app/schemas/ocr.py). Only the fields the app reads.
type OcrMedicine = FdaMedicine & {
  match_score?: number;
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

// The latest real scan, read by the Scan Result and Edit Medicine screens. Kept here rather than in route
// params because medicine names can contain "%" (e.g. "5% Dextrose"), which is unsafe in a URL.
let latestScan: ScanResult | null = null;
let latestScanTelemetry: ScanTelemetry | null = null;
let latestScanMedicines: FdaMedicine[] = [];
export const getLatestScan = () => latestScan;
export const getLatestScanTelemetry = () => latestScanTelemetry;
export const getLatestScanMedicines = () => latestScanMedicines;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFdaMedicine(value: unknown): value is FdaMedicine {
  if (!isRecord(value)) return false;
  return (
    typeof value.fda_id === 'number' &&
    Number.isInteger(value.fda_id) &&
    value.fda_id > 0 &&
    typeof value.fda_registration_id === 'string' &&
    typeof value.fda_approval_id === 'string' &&
    typeof value.fda_genericname === 'string' &&
    (value.fda_brandname === null || typeof value.fda_brandname === 'string') &&
    (value.fda_dosage_form === null || typeof value.fda_dosage_form === 'string') &&
    (value.fda_dosage_strength === null || typeof value.fda_dosage_strength === 'string') &&
    (value.fda_manufacturer === null || typeof value.fda_manufacturer === 'string') &&
    (value.fda_pharmacologic_category === null ||
      typeof value.fda_pharmacologic_category === 'string') &&
    (value.fda_classification === null || typeof value.fda_classification === 'string')
  );
}

export async function searchFdaMedicines(query: string): Promise<FdaMedicine[]> {
  const term = query.trim();
  if (!term) return [];
  const apiBase = getApiV1Url();
  if (!apiBase) throw new Error('Backend URL is not ready yet. Wait a moment or check Wi-Fi/Hotspot.');

  const authorization = MockAuth.getAuthorizationHeader();
  const response = await fetch(
    `${apiBase}/medicines/search?q=${encodeURIComponent(term)}&limit=20`,
    { headers: authorization ? { Authorization: authorization } : {} },
  );
  const responseBody: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      isRecord(responseBody) && typeof responseBody.detail === 'string'
        ? responseBody.detail
        : isRecord(responseBody) && typeof responseBody.message === 'string'
          ? responseBody.message
          : `The FDA medicine search failed (${response.status}).`;
    throw new Error(detail);
  }
  if (!isRecord(responseBody) || !Array.isArray(responseBody.data)) {
    throw new Error('The FDA medicine search returned an invalid response.');
  }

  const medicines = responseBody.data.filter(isFdaMedicine);
  if (medicines.length !== responseBody.data.length) {
    throw new Error('The FDA medicine search returned an invalid medicine record.');
  }
  return medicines;
}

function toInfoRows(rows: (MedicineInfoRow | false)[]): MedicineInfoRow[] {
  return rows.filter((row): row is MedicineInfoRow => row !== false);
}

function displayName(medicine: OcrMedicine): string {
  return [medicine.fda_brandname || medicine.fda_genericname, medicine.fda_dosage_strength].filter(Boolean).join(' ');
}

function getFdaMatchPercentage(medicine: OcrMedicine): number {
  const score = medicine.match_score;
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
    ? Math.round(score * 100)
    : medicine.confidence_percentage;
}

function toScanResult(response: OcrResponse): ScanResult {
  const { entities, suggested_medicines } = response;
  const candidates = suggested_medicines.filter(
    (medicine) => getFdaMatchPercentage(medicine) >= NEEDS_VERIFICATION_MIN_CONFIDENCE,
  );
  const best = candidates[0];
  const confidence = best ? getFdaMatchPercentage(best) : 0;
  const safetyTier = getConfidenceTier(toScanTelemetry(response));

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

  if (
    confidence < VERIFIED_MIN_CONFIDENCE ||
    (safetyTier !== null && safetyTier !== 'high')
  ) {
    return {
      status: 'needs_verification',
      confidence,
      matches: candidates.slice(0, MAX_POSSIBLE_MATCHES).map((m) => ({
        id: m.fda_approval_id,
        name: displayName(m),
        category: m.fda_genericname,
        form: m.fda_dosage_form ?? '',
        strength: m.fda_dosage_strength ?? '',
        similarity: getFdaMatchPercentage(m),
        medicine: m,
      })),
    };
  }

  // The same product can be registered by several makers, so only name one when the matches agree.
  const manufacturerIsCertain = candidates.every(
    (m) =>
      getFdaMatchPercentage(m) < confidence ||
      m.fda_manufacturer === best.fda_manufacturer,
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
  const best =
    response.suggested_medicines.find(
      (medicine) => getFdaMatchPercentage(medicine) >= NEEDS_VERIFICATION_MIN_CONFIDENCE,
    ) ?? response.suggested_medicines[0];
  const fdaMatchScore = best
    ? getFdaMatchPercentage(best) / 100
    : telemetry.fda_match_score ?? null;
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
    fda_match_score: fdaMatchScore,
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
  const apiBase = getApiV1Url();
  if (!apiBase) throw new Error('Backend URL is not ready yet. Wait a moment or check Wi-Fi/Hotspot.');

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
    const authorization = MockAuth.getAuthorizationHeader();
    const response = await fetch(`${apiBase}/ocr/extract-label`, {
      method: 'POST',
      body,
      headers: authorization ? { Authorization: authorization } : {},
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
    latestScanMedicines = ocrResponse.suggested_medicines;
    latestScanTelemetry = toScanTelemetry(ocrResponse);
    latestScan = toScanResult(ocrResponse);
    return latestScan;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The scan request timed out. Try again with a smaller, clearer image.');
    }
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      throw new Error(
        `Network request failed when contacting ${apiBase}/ocr/extract-label. Check that your phone and laptop are on the same Wi-Fi/Hotspot and the backend is running.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
