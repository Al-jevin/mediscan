# MediScan Snapshot Contract Matrix

Source of truth for OCR scan → FDA match → Vault save alignment.

## 1. Endpoint Contract

| Aspect | Backend (`app/api/v1/ocr.py`) | Legacy Client (`camera.tsx` / `mockScanResults.ts`) | Resolved Contract |
|---|---|---|---|
| Route | `POST /api/v1/ocr/extract-label` | `POST https://PLACEHOLDER-URL/api/scan` | `POST ${API_BASE_URL}/api/v1/ocr/extract-label` |
| Content-Type | `multipart/form-data` (`file`) | `application/json` (`{ image: base64 }`) | `multipart/form-data` (`file` JPEG URI from `manipulateAsync`) |
| Top-level response | `OCRResponse`: `{ success, code, message, entities, suggested_medicines }` | `ApiResponse`: `{ header: { success, code, message }, data: ApiMedicine[] }` | Client consumes `OCRResponse` via `ocrAdapter.ts` |

## 2. Field Mapping: `LinkedMedicineResponse` ↔ `FdaMedicine` / `VaultMedicine`

| Backend (`schemas/ocr.py`) | Type | Client (`types/medicine.ts`) | Adapter / Vault Rule |
|---|---|---|---|
| `fda_id` | `int (>=1)` | *(not in `FdaMedicine`)* | Preserved in `LinkedMedicineResponse`; optional metadata |
| `fda_approval_id` | `str` | `fda_approval_id: string` | Direct 1:1 (`PossibleMatch.id`) |
| `fda_registration_id` | `str` | `fda_registration_id: string` | Direct 1:1 |
| `fda_brandname` | `str \| None` | `fda_brandname: string` | Fallback to `fda_genericname` when `null` |
| `fda_genericname` | `str` | `fda_genericname: string` | Direct 1:1 |
| `fda_dosage_form` | `str \| None` | `fda_dosage_form: string` | Fallback to `'Other'` when `null` |
| `fda_dosage_strength` | `str \| None` | `fda_dosage_strength: string` | Fallback to `entities.dosage ?? ''` when `null` |
| `fda_manufacturer` | `str \| None` | `fda_manufacturer: string \| null` | Direct 1:1 |
| `fda_pharmacologic_category` | `str \| None` | `fda_pharmacologic_category: string \| null` | Direct 1:1 |
| `fda_classification` | `str \| None` | `fda_classification: string \| null` | Direct 1:1 |
| `confidence_percentage` | `int (0..100)` | `vault_confidence: number \| null` | Direct 1:1 (`PossibleMatch.similarity`) |
| `confidence_level` | `'max' \| 'high' \| 'medium' \| 'low'` | Drives `ScanState` (`verified` vs `needs_verification`) | `'max' \| 'high'` with 1 hit → `verified`; else `needs_verification` |
| `entities.expiry_date` | `str \| None` | `vault_expiry_date: string \| null` | Parsed to `YYYY-MM-DD` when valid; else `null` (user edits) |
| *(client local)* | — | `vault_status: 'verified' \| 'needs_verification'` | Set from scan state or `'needs_verification'` on manual entry |
| *(client local)* | — | `vault_source: 'scan' \| 'manual'` | `'scan'` from OCR result/edit; `'manual'` from Manual Entry |

## 3. UI State Derivation (`ocrResponseToScanResult`)

1. **Unreadable / Empty OCR (`isOcrEmpty`):** `suggested_medicines.length === 0` AND all `entities` fields (`medicine_name`, `dosage`, `frequency`, `expiry_date`) are `null`/empty → trigger `CantReadModal` on Camera screen (or `no_results` on Result screen).
2. **No FDA Match (`no_results`):** `suggested_medicines.length === 0` (with non-empty entities) → `ScanResult { status: 'no_results' }`.
3. **Verified (`verified`):** `suggested_medicines.length === 1` AND `confidence_level` in `['max', 'high']` (or `confidence_percentage >= 85`) → `ScanResult { status: 'verified', confidence, medicine, info, fdaMedicine, rawExpiry }`.
4. **Needs Verification (`needs_verification`):** Multiple suggestions OR single suggestion with `confidence_level` in `['medium', 'low']` → `ScanResult { status: 'needs_verification', confidence, matches }` (capped at 4 matches; requires user selection before saving).
