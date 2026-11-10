# MediScan Real-Data Integration Test Checklist

Run this checklist against the configured PostgreSQL database, FastAPI backend, and Expo frontend. Do not use mock medicines, mock profiles, hard-coded OCR results, or a mock fallback to mark a check as passed.

## Test setup

- [ ] Root `.env` points to the intended PostgreSQL database.
- [ ] `philippines_fda_medicines` contains the real FDA records used for testing.
- [ ] A controlled test account is available; its credentials are not committed.
- [ ] Backend starts on `http://127.0.0.1:8000`.
- [ ] Frontend uses `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`.
- [ ] Frontend API mode is enabled.
- [ ] Brevo sender and SMTP credentials are configured only through the local environment.

## A. Backend health and infrastructure

| ID | Check | Expected result | Status |
| --- | --- | --- | --- |
| A-01 | `GET /api/v1/` | Returns the API status response | [ ] |
| A-02 | `GET /api/v1/health` | Returns a healthy status | [ ] |
| A-03 | Database connection | Requests read/write the configured PostgreSQL database | [ ] |
| A-04 | FDA data lookup | Medicine responses contain real rows from `philippines_fda_medicines` | [ ] |
| A-05 | CORS preflight | Local Expo origin is accepted; unconfigured origins are not trusted | [ ] |
| A-06 | Error envelope | Invalid requests return a useful non-2xx error without fake success data | [ ] |

## B. Authentication and email

| ID | Check | Expected result | Status |
| --- | --- | --- | --- |
| B-01 | Register a new email | Real account row is created and verification delivery is reported | [ ] |
| B-02 | Register an existing email | Existing-account state is reported; no duplicate account is created | [ ] |
| B-03 | Verify with valid code | Real account becomes verified and can log in | [ ] |
| B-04 | Verify with invalid/expired code | Request is rejected; account is not falsely verified | [ ] |
| B-05 | Resend code | A new real verification request is created/delivered when allowed | [ ] |
| B-06 | Login | Real account receives a bearer token | [ ] |
| B-07 | Unverified login | Login is rejected until verification is complete | [ ] |
| B-08 | Logout/logout-all | Session tokens are invalidated and protected requests fail afterward | [ ] |

## C. OCR, vision, NER, and medicine linking

| ID | Check | Expected result | Status |
| --- | --- | --- | --- |
| C-01 | Upload a clear real label image | Vision OCR extracts text from the uploaded bytes | [ ] |
| C-02 | Inspect NER output | Entities have the expected schema and are derived from OCR text | [ ] |
| C-03 | Match a known FDA medicine | Suggested medicine is a real database row with confidence/guidance | [ ] |
| C-04 | Match an unknown label | Response returns no match without fabricated medicine data | [ ] |
| C-05 | Upload an unreadable image | Safe no-result/error response; no hard-coded verified result | [ ] |
| C-06 | Upload invalid/oversized input | Request is rejected clearly and does not invoke a fake success path | [ ] |
| C-07 | Frontend camera upload | Image reaches `POST /api/v1/ocr/extract-label` | [ ] |
| C-08 | Frontend verified result | Displays the returned real medicine and confidence | [ ] |
| C-09 | Frontend needs-verification result | Displays returned candidates and uses their real FDA IDs | [ ] |
| C-10 | Frontend no-results result | Displays no-results state without mock scan data | [ ] |

## D. Profiles and medicine APIs

| ID | Check | Expected result | Status |
| --- | --- | --- | --- |
| D-01 | New account profiles | Newly created account returns `profiles: []` | [ ] |
| D-02 | Create profile | Real profile row is created for the authenticated account | [ ] |
| D-03 | List profiles | Only the authenticated account's real profiles are returned | [ ] |
| D-04 | Update profile | Real row changes and persists after reload | [ ] |
| D-05 | Delete profile | Real row is removed/soft-deleted and no longer listed | [ ] |
| D-06 | Cross-account profile access | Other account's profile cannot be read or changed | [ ] |
| D-07 | Medicine lookup | Results are real FDA rows with stable IDs | [ ] |
| D-08 | Medicine assignment endpoints | Results reflect real account/profile/database state, not fixed sample values | [ ] |

## E. Vault persistence

| ID | Check | Expected result | Status |
| --- | --- | --- | --- |
| E-01 | List vault | Frontend displays real rows for the selected profile | [ ] |
| E-02 | Save scanned medicine | A real `vault_items` row is created using the returned FDA ID | [ ] |
| E-03 | Save invalid medicine/profile | Backend rejects it without local fake success | [ ] |
| E-04 | Edit expiry/details | Real vault row is updated and remains updated after reload | [ ] |
| E-05 | Delete with undo | Delete only commits after the undo window and removes the real row | [ ] |
| E-06 | Cross-account vault access | Other accounts cannot read, update, or delete the row | [ ] |
| E-07 | Restart persistence | Data remains after restarting backend and frontend | [ ] |

## F. Frontend behavior and failure handling

| ID | Check | Expected result | Status |
| --- | --- | --- | --- |
| F-01 | Login/session reload | Stored real token restores the session or redirects after expiry | [ ] |
| F-02 | API unavailable | User sees an error/retry state; mock data is not displayed | [ ] |
| F-03 | Empty database result | UI shows an empty state; it does not invent records | [ ] |
| F-04 | Profile selection | Selected real profile ID is used by vault requests | [ ] |
| F-05 | Web target | Uses configured API URL and real responses | [ ] |
| F-06 | Android/iOS target | Does not use `localhost`/`127.0.0.1` for a remote deployment | [ ] |
| F-07 | Typecheck/lint | Changed integration code passes applicable checks | [ ] |

## Evidence log

For each failed check, record the test ID, timestamp, request/UI action, response status/body, backend log excerpt with secrets removed, frontend error, and database row state. Classify the failure as backend logic, database/data, API contract, frontend mapping/state, environment, or infrastructure.
