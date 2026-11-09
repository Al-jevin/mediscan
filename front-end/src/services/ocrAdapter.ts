import { Assets } from '@/constants/assets';
import type { MedicineInfoRow } from '@/components/MedicineInfoCard';
import type { PossibleMatch, ScanResult } from '@/data/mockScanResults';
import type { FdaMedicine, NewMedicine, VerificationStatus } from '@/types/medicine';
import { formatLongDate, mdyToYMD } from '@/utils/medicine';

export type ExtractedEntityResponse = {
  medicine_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  expiry_date?: string | null;
};

export type ConfidenceLevel = 'max' | 'high' | 'medium' | 'low';

export type LinkedMedicineResponse = {
  fda_id: number;
  fda_registration_id: string;
  fda_approval_id: string;
  fda_brandname?: string | null;
  fda_genericname: string;
  fda_dosage_form?: string | null;
  fda_dosage_strength?: string | null;
  fda_manufacturer?: string | null;
  fda_pharmacologic_category?: string | null;
  fda_classification?: string | null;
  match_type?: 'exact' | 'fuzzy';
  match_score: number;
  confidence_percentage: number;
  confidence_level: ConfidenceLevel;
  accuracy_guidance?: string;
};

export type OCRResponse = {
  success: boolean;
  code: number;
  message: string;
  entities: ExtractedEntityResponse;
  suggested_medicines: LinkedMedicineResponse[];
};

const MAX_POSSIBLE_MATCHES = 4;

export function isOcrEmpty(res: OCRResponse): boolean {
  const e = res.entities;
  const hasAnyEntity = Boolean(
    e?.medicine_name?.trim() ||
      e?.dosage?.trim() ||
      e?.frequency?.trim() ||
      e?.expiry_date?.trim(),
  );
  return !hasAnyEntity && (!res.suggested_medicines || res.suggested_medicines.length === 0);
}

export function normalizeExpiryToYMD(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const mdy = mdyToYMD(trimmed);
  if (mdy) return mdy;
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0');
    const yyyy = slashMatch[2];
    return `${yyyy}-${mm}-01`;
  }
  return null;
}

export function linkedToFdaMedicine(m: LinkedMedicineResponse, fallbackDosage?: string | null): FdaMedicine {
  const generic = m.fda_genericname || m.fda_brandname || 'Unknown Medicine';
  const brand = m.fda_brandname || generic;
  return {
    fda_approval_id: m.fda_approval_id,
    fda_registration_id: m.fda_registration_id,
    fda_brandname: brand,
    fda_genericname: generic,
    fda_dosage_form: m.fda_dosage_form || 'Other',
    fda_dosage_strength: m.fda_dosage_strength || fallbackDosage || '',
    fda_manufacturer: m.fda_manufacturer ?? null,
    fda_pharmacologic_category: m.fda_pharmacologic_category ?? null,
    fda_classification: m.fda_classification ?? null,
  };
}

export function ocrResponseToScanResult(res: OCRResponse): ScanResult {
  const suggestions = res.suggested_medicines ?? [];
  if (suggestions.length === 0) {
    return { status: 'no_results' };
  }

  const top = suggestions[0];
  const isHighConfidenceSingle =
    suggestions.length === 1 &&
    (top.confidence_level === 'max' || top.confidence_level === 'high' || top.confidence_percentage >= 85);

  const normalizedExpiry = normalizeExpiryToYMD(res.entities?.expiry_date);

  if (isHighConfidenceSingle) {
    const fda = linkedToFdaMedicine(top, res.entities?.dosage);
    const displayName = [fda.fda_brandname, fda.fda_dosage_strength].filter(Boolean).join(' ').trim();
    const info: MedicineInfoRow[] = [
      {
        icon: Assets.icons.manufacturer,
        label: 'Manufacturer',
        value: fda.fda_manufacturer || fda.fda_pharmacologic_category || 'Not listed',
      },
      {
        icon: Assets.icons.expiryDate,
        label: 'Expiry Date',
        value: normalizedExpiry ? formatLongDate(normalizedExpiry) : res.entities?.expiry_date || 'Not detected',
      },
      {
        icon: Assets.icons.batchNumber,
        label: 'Registration ID',
        value: fda.fda_registration_id || 'N/A',
      },
      {
        icon: Assets.icons.medicineType,
        label: 'Medicine Type',
        value: fda.fda_dosage_form || 'Other',
      },
      {
        icon: Assets.icons.strength,
        label: 'Strength',
        value: fda.fda_dosage_strength || 'Not specified',
      },
    ];

    return {
      status: 'verified',
      confidence: top.confidence_percentage,
      medicine: {
        name: displayName || fda.fda_genericname,
        category: fda.fda_genericname,
        form: fda.fda_dosage_form,
      },
      info,
      fdaMedicine: fda,
      expiryYMD: normalizedExpiry,
    };
  }

  const matches: PossibleMatch[] = suggestions.slice(0, MAX_POSSIBLE_MATCHES).map((m) => {
    const fda = linkedToFdaMedicine(m, res.entities?.dosage);
    const displayName = [fda.fda_brandname, fda.fda_dosage_strength].filter(Boolean).join(' ').trim();
    return {
      id: fda.fda_approval_id,
      name: displayName || fda.fda_genericname,
      category: fda.fda_genericname,
      form: fda.fda_dosage_form,
      strength: fda.fda_dosage_strength,
      similarity: m.confidence_percentage,
      fdaMedicine: fda,
      expiryYMD: normalizedExpiry,
    };
  });

  return {
    status: 'needs_verification',
    confidence: top.confidence_percentage,
    matches,
  };
}

export function buildNewMedicineFromFda(
  fda: FdaMedicine,
  opts: {
    status: VerificationStatus;
    source: 'scan' | 'manual';
    confidence?: number | null;
    expiryYMD?: string | null;
    overrideName?: string;
    note?: string;
  },
): NewMedicine {
  const trimmedName = opts.overrideName?.trim();
  return {
    ...fda,
    fda_brandname: trimmedName || fda.fda_brandname,
    vault_expiry_date: opts.expiryYMD ?? null,
    vault_status: opts.status,
    vault_source: opts.source,
    vault_confidence: opts.confidence ?? null,
    vault_note: opts.note ?? '',
  };
}
