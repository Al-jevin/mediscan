# MediScan Snapshot Report & Civilian QA Guide

## 1. What Was Fixed in This Pass

1. **OCR Runtime Compatibility (Python 3.14):** `paddlepaddle` has no wheel for Python 3.14. `back-end/app/services/vision.py` now uses `PaddleOCR` when present and falls back to `RapidOCR` (PP-OCRv6 ONNX models via `onnxruntime`), keeping `extract_text(image_bytes)` working out-of-the-box.
2. **Zero-Config FDA Linker Fallback:** `back-end/app/api/v1/ocr.py` and `back-end/app/services/data_linker.py` now fall back to the 29,227-row in-memory FDA CSV index (`app/data/mediscan_dataset.csv`) when PostgreSQL is offline or unconfigured. Also returns up to 4 candidate matches for `needs_verification`.
3. **NLP Boilerplate Filter:** `back-end/app/services/nlp_service.py` now ignores `FDA Reg. No.` lines when extracting brand/generic names so registration numbers do not pollute `medicine_name`.
4. **Live Camera → `/api/v1/ocr/extract-label` Wire:**
   - Added `front-end/src/constants/apiConfig.ts` (auto-detects Expo LAN host IP or `EXPO_PUBLIC_API_BASE_URL`, defaults to `http://192.168.1.50:8000`).
   - Added `front-end/src/services/ocrAdapter.ts` (`ocrResponseToScanResult`, `isOcrEmpty`, `buildNewMedicineFromFda`) and `front-end/src/services/scanSession.ts`.
   - Updated `front-end/src/app/(tabs)/camera.tsx` to send `multipart/form-data` (`file`) to `POST /api/v1/ocr/extract-label` and open `CantReadModal` when no text is detected.
5. **Real Save-to-Vault & Confirmation Gate:**
   - `result.tsx`, `edit-medicine.tsx`, and `manual-entry.tsx` now call `vaultStore.addMedicine(...)` (persisting to `AsyncStorage` + `changeLog`) before opening `MedicineAddedModal`.
   - `ScanActions.tsx` hides **Save to Vault** in `needs_verification` until the user explicitly selects a candidate match.
   - `Datasync.tsx` copy updated so it does not falsely claim cloud sync is active.

---

## 2. Generated OCR Fixtures & Golden Outputs

Generated via `back-end/tests/generate_label_fixtures.py` under `mediscan/back-end/tests/fixtures/labels/`:

| Fixture | Input Text | Extracted Entities | FDA Matches | Derived UI State |
|---|---|---|---|---|
| `01_verified_reg_id.png` | `MISTEL` / `Telmisartan 80 mg Tablet` / `FDA Reg. No.: DRP-16103` / `EXP: 12/31/2028` | `medicine_name`: `MISTEL Telmisartan`, `dosage`: `80 mg`, `expiry_date`: `12/31/2028` | 1 (`Mistel`, `DRP-16103`, `max` 100%) | `verified` |
| `02_needs_verification_multi.png` | `HEPARIN LEO` / `Heparin Sodium` / `Solution For Injection` | `medicine_name`: `Heparin Sodium`, `dosage`: `null` | 4 (`Heparin Leo` 5,000 IU/mL, 1,000 IU/mL, etc.) | `needs_verification` |
| `03_low_contrast_no_match.png` | `UNKNOWNXYZ SUPPLEMENT 999 mg` | `medicine_name`: `UNKNOWNXYZ SUPPLEMENT`, `dosage`: `999 mg` | 0 | `no_results` |
| `04_blank_unreadable.png` | *(blank white image)* | all `null` | 0 | `CantReadModal` |

---

## 3. How to Boot & Run Phone QA (Expo Go)

### Step A — Start Backend (Terminal 1)
```powershell
cd "c:\Users\Luke Gabriel\Desktop\CodeWithLuke\Projects\MediScan\mediscan\back-end"
& "C:\Users\Luke Gabriel\AppData\Local\Python\pythoncore-3.14-64\python.exe" -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000 --reload
```
- Verify on PC: `http://127.0.0.1:8000/api/v1/health` and `http://127.0.0.1:8000/crud-tester/`

### Step B — Start Expo Go (Terminal 2)
```powershell
cd "c:\Users\Luke Gabriel\Desktop\CodeWithLuke\Projects\MediScan\mediscan\front-end"
npx expo start
```
- Ensure phone and PC are on the same Wi‑Fi (`getApiBaseUrl()` auto-detects the Expo host IP, or override with `$env:EXPO_PUBLIC_API_BASE_URL="http://<PC-LAN-IP>:8000"`).
- To test offline UI mocks without backend: `$env:EXPO_PUBLIC_USE_OCR_MOCK="true"`.

### Step C — Civilian Phone QA Checklist
1. **Verified Scan:** Send/display `01_verified_reg_id.png` → scan or pick from gallery → verify `Verified Medicine (100%)` banner for **Mistel 80 mg** with expiry `Dec 31, 2028` → tap **Save to Vault** → verify item persists in Vault after app reload.
2. **Needs Verification Gate:** Scan `02_needs_verification_multi.png` → verify **Save to Vault** is hidden until a card is tapped → select a match → tap **Edit** or **Save to Vault** → verify saved in Vault.
3. **Unreadable Image:** Scan `04_blank_unreadable.png` → verify **We couldn't read the text** (`CantReadModal`) opens → tap **Enter Details Manually** → type `Biogesic` + expiry → **Save to Vault**.
4. **No Results:** Scan `03_low_contrast_no_match.png` → verify `No Results` screen and non-misleading hint text.

---

## 4. What Remains Mock / Deferred (Next Pass)

- **Authentication & Profiles:** Uses in-memory `MockAuth` (`src/mock/mockAuth.ts`); not yet wired to `/api/v1/auth`.
- **Cloud Sync:** `vaultStore` and `changeLog` persist locally in `AsyncStorage` (`mediscan.vault.medicines.v1` / `mediscan.changeLog.v1`); replay to PostgreSQL is deferred until live auth/profile IDs are wired.
- **PostgreSQL CRUD:** Optional for OCR (CSV index handles live matching), required when testing account/profile/schedule DB routes in `crud_user.py` / `crud_medicine.py`.
