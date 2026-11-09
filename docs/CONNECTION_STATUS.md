# MediScan FE to BE connection status

Final QA write-up: [`FINAL_CONNECTION_QA.md`](./FINAL_CONNECTION_QA.md).

## Green light checklist (after Postgres is running)

| Feature | Linked? | Notes |
|---|---|---|
| Login / Signup / Brevo verify | YES | App calls `/api/v1/auth/register`, `/verify-email`, `/resend-code`, `/login`, `/logout` |
| Profiles | YES | App calls `/api/v1/accounts/me/profiles` (real CRUD). IDs are hex strings; FE uses `ProfileId` |
| OCR / NER | YES | App calls `/api/v1/ocr/extract-label` (works with CSV linker; no Postgres required) |
| MediScan Vault | YES (best effort) | Saves on phone first, then posts to `/api/v1/vault` when logged in and FDA id resolves |
| Reminders | YES (best effort) | Saves on phone first, then posts to `/api/v1/schedules` when medicine name matches FDA search |
| Settings sync | YES | Sync Now runs `syncPendingChanges` against the server |
| Home / Dashboard | YES (data) | Reads local vault + reminders (same as before) |

If the backend or Postgres is down, the app falls back to on-device mock auth so screens still open.

## Last stress run

- Script: `mediscan/back-end/scripts/stress_connection.py`
- Result: **0 failures** (health, OCR clear/blank, auth/vault/schedules guards, fixture golden)
- Host note: Postgres `5432` and API `8000` were closed at check time; full live auth still needs DB up

## What `.env` does

`.env` configures the **server only** (DB + Brevo). The phone reads `EXPO_PUBLIC_API_BASE_URL` / LAN IP from `apiConfig.ts`, not the root `.env`.

## Boot order for a full green test

1. Start Postgres with the schema from `mediscan/01-schema.sql` and seed FDA rows into `philippines_fda_medicines`.
2. Confirm `.env` `DATABASE_URL` works.
3. Start API:
   ```powershell
   cd mediscan\back-end
   py -3 -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000 --reload
   ```
4. Start Expo and open on phone (same Wi-Fi):
   ```powershell
   cd mediscan\front-end
   npx expo start -c
   ```
5. Sign up with a real email (Brevo sends the code), verify, create a profile, scan, save, add a reminder, tap Sync.
