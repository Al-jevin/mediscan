# MediScan final connection QA

Date: 2026-11-10  
Scope: FE↔BE wiring for auth, profiles, OCR, vault, reminders, settings sync. Screen UX logic unchanged.

## Verdict

Wiring is final for the green-lit path. OCR and route guards pass without Postgres. Full live auth / vault / schedules still need Postgres up and seeded on this machine.

## Recritique (what was wrong, what we fixed)

| Finding | Severity | Status |
|---|---|---|
| `ProfileContext` treated `profile_id` as `number` while live API returns 16-char hex strings | High | Fixed: `ProfileId` + string-safe compares in context and `ProfileDetailScreen` |
| `medicine.ts` `Profile.profile_id` typed as `number` only | Medium | Fixed: `string \| number` |
| Root `.env` mistaken for phone API link | Docs only | Clarified: phone uses `EXPO_PUBLIC_API_BASE_URL` / `apiConfig.ts` |
| Postgres / API ports down during final check | Env | Still down on this host (`5432`, `8000` closed). Not a code defect |
| OCR on Python 3.14 | Resolved earlier | RapidOCR fallback; stress test confirmed clear-label match |

No other wiring gaps found that would block offline-first use or OCR CSV matching.

## Feature link map

| Feature | App entry | Adapter | Backend | Local fallback |
|---|---|---|---|---|
| Signup / verify / login | `signup.tsx`, `verify-code.tsx`, `login.tsx` | `MockAuth` | `/api/v1/auth/*` | On-device mock when API/DB unreachable |
| Profiles | `create-profile`, `choose-profile`, Profile screens | `MockAuth` + `ProfileContext` | `/api/v1/accounts/me/profiles` | Mock profiles |
| OCR scan | `camera.tsx` → `result` / `edit` | `ocrAdapter.ts` | `POST /api/v1/ocr/extract-label` | `USE_OCR_MOCK` if set |
| Vault save | `vaultStore.ts` | `backendSync.pushVaultMedicine` | `/api/v1/vault` | AsyncStorage first |
| Reminders | `reminders.tsx` | `backendSync.pushReminder` | `/api/v1/schedules` | Local first |
| Sync Now | `Datasync.tsx` | `syncPendingChanges` | vault + schedules | No-op if not live |

## Stress test (final)

Command:

```powershell
cd mediscan\back-end
py -3 scripts\stress_connection.py
```

Results (2026-11-10, failures = 0):

| Check | Result |
|---|---|
| `GET /api/v1/health` | PASS |
| Clear synthetic label → FDA suggestion (`DRP-16103` / Mistel, conf max) | PASS |
| Blank image → empty entities / no match | PASS |
| Login without Postgres → `503` (no crash) | PASS |
| Profiles / vault / schedules without token → `401` | PASS |
| Label fixture golden shape present | PASS |

Host ports at test time: `5432` CLOSED, `8000` CLOSED (TestClient embeds the app; no uvicorn needed for this script).

## What still needs a human for full green light

1. Start Postgres; apply `mediscan/01-schema.sql`; seed `philippines_fda_medicines`.
2. Confirm root `.env` `DATABASE_URL` + Brevo keys.
3. Run API:
   ```powershell
   cd mediscan\back-end
   py -3 -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000 --reload
   ```
4. Point the phone at the PC LAN URL (`EXPO_PUBLIC_API_BASE_URL` or `apiConfig.ts`).
5. Expo Go + same Wi-Fi; sign up → verify email → profile → scan → vault → reminder → Sync Now.

## Honest limits (unchanged product rules)

- MediScan is identification + layman context, not diagnosis / dosing.
- Vault and schedules sync only when logged in, live backend is up, and an FDA id / name resolve succeeds.
- Without Postgres, auth and DB-backed vault/schedules stay on mock / phone storage; OCR can still match via CSV.

## Related docs

- `CONNECTION_STATUS.md` — short green-light checklist
- `SNAPSHOT_CONTRACT.md` / `SNAPSHOT_REPORT.md` — OCR snapshot contract
- `back-end/scripts/stress_connection.py` — repeatable no-Postgres stress suite
