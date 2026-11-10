import { Platform } from 'react-native';
import type { MedicineInfoRow } from '@/components/MedicineInfoCard';
import { Assets } from '@/constants/assets';
import type { ScanResult } from '@/data/mockScanResults';
import type { FdaMedicine } from '@/types/medicine';
import { API_V1_URL } from '@/services/apiUrl';

// Shape of POST /api/v1/ocr/extract-label (back-end/app/schemas/ocr.py). Only the fields the app reads.
type OcrMedicine = FdaMedicine & {
  confidence_percentage: number;
};
type OcrEntities = {
  medicine_name: string | null;
  dosage: string | null;
  expiry_date: string | null;
};
type OcrResponse = { entities: OcrEntities; suggested_medicines: OcrMedicine[] };

const REQUEST_TIMEOUT_MS = 90_000; // PaddleOCR on a CPU can take a while

const VERIFIED_MIN_CONFIDENCE = 90;
const NEEDS_VERIFICATION_MIN_CONFIDENCE = 65;
const MAX_POSSIBLE_MATCHES = 4;

// The latest real scan, read by the Scan Result and Edit Medicine screens. Kept here rather than in route
// params because medicine names can contain "%" (e.g. "5% Dextrose"), which is unsafe in a URL.
let latestScan: ScanResult | null = null;
export const getLatestScan = () => latestScan;

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

    latestScan = toScanResult(responseBody as OcrResponse);
    return latestScan;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The scan request timed out. Try again with a smaller, clearer image.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
