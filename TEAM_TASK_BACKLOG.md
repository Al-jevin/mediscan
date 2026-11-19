# MediScan Team Task Backlog

This backlog expands the current GitHub issue set into parallel frontend, backend, and QA work. Prefer creating child issues under the existing parent issues rather than duplicating their scope.

## Current issue and test context

- The open issue list already contains frontend work in #33, #32, #31, #30, #29, #26, #24, and frontend portions of #25 and #23.
- #30 already includes OCR upload validation, scanned medicine photos, and manual-entry verification; split those into independently assignable tasks.
- #27 is the manual QA documentation issue. Keep automated tests in separate issues to respect its docs-only ownership.
- Backend suite: `python -m pytest back-end/tests -q` — 66 passed, 3 deprecation warnings.
- Frontend has no test script or existing test suite.
- `npm run lint` currently reports 47 errors and 4 warnings. `npx tsc --noEmit` fails on existing type issues in shared components and hooks.
- The checked-in OCR benchmark report marks all stages unconfirmed and reports entity F1 of 41.86% and dosage accuracy of 10%. The benchmark manifest contains a `TODO_FILL_ME` expected dosage.

## Frontend

### 1. [Frontend][OCR] Add retryable failure recovery across web and Expo Go

**Related:** #27, #30

**Description:** A failed upload currently ends at an alert. Add a recovery path for common OCR failures so users can correct the problem or retry without restarting the scan.

**Acceptance criteria**

- Show distinct, user-actionable guidance for expired or invalid auth, unsupported or oversized image, unreadable image, backend unavailable, network failure, and timeout.
- Offer retry or image reselection where appropriate; keep loading state correct and navigate to results only after a successful response.
- Keep camera capture and gallery upload behavior consistent on web and Expo Go.
- Add focused frontend tests for multipart upload and auth headers, error mapping, timeout, and retry/loading transitions.

### 2. [Frontend][OCR] Display and persist scanned medicine photos

**Split from:** #30

**Description:** Show the captured or uploaded image in medicine details and allow replacing it.

**Acceptance criteria**

- Display the scan image in the medicine details view and provide an attach/replace action.
- Decide whether persistence is device-local or account-synced and document the choice.
- Verify the image remains available after app restart and handle missing or deleted image files gracefully.
- Test camera capture and gallery selection on web and Expo Go.

### 3. [Frontend][OCR] Verify manually entered medicines by rescanning

**Split from:** #30

**Description:** Add a Verify via OCR flow for medicines marked Needs Verification.

**Acceptance criteria**

- Launch the existing scan flow from an unverified medicine record.
- Compare scan results with the existing medicine and show the detected differences before saving.
- Require confirmation before changing verification state; do not silently overwrite user-entered values.
- Prevent duplicate vault records and test match, mismatch, no-match, and canceled-scan behavior.

### Existing frontend issues available for assignment

- #33 — Upload custom profile photos.
- #32 — Apply text size globally and resolve Expo Web hydration errors.
- #31 — Validate emergency-contact and text inputs; fix input sizing.
- #29 — Fix reminder date filtering and date/time input validation.
- #26 — Add moderate-confidence save confirmation and fix nested buttons.
- #24 — Persist dark mode and English/Filipino localization.
- Frontend portions of #25 — Notifications UI and native notification permissions.
- Frontend portions of #23 — Terms, disclaimer, and account consent flow.

## Backend

### 4. [Backend][OCR] Enforce and document accepted upload formats

**Split from:** #30

**Description:** The OCR endpoint enforces a 10 MiB size limit and the image pipeline rejects undecodable bytes, but the route has no explicit supported-format allowlist.

**Acceptance criteria**

- Define accepted formats explicitly. Decide whether SVG is supported; if so, rasterize it safely rather than passing it directly to the OCR decoder.
- Validate decoded content, not only the filename extension or client-provided MIME type.
- Return documented 415, 413, and 422 responses for unsupported type, oversized upload, and malformed/unreadable image.
- Add API tests for valid PNG/JPEG, spoofed MIME or extension, empty/corrupt files, oversized files, and SVG according to the agreed contract.
- Assert rejected uploads do not invoke OCR processing.

### 5. [Backend][Consent] Persist and enforce terms acceptance

**Split from:** #23

**Description:** Persist the user's acceptance and enforce consent at account creation.

**Acceptance criteria**

- Store the acceptance timestamp and terms version.
- Reject account creation without acceptance.
- Define behavior when the terms version changes.
- Add tests for accepted, rejected, repeated, and persisted consent.

### 6. [Backend][Notifications] Add profile-scoped notification APIs and token lifecycle

**Split from:** #25

**Description:** Implement backend support for account/profile-scoped notifications and device push tokens.

**Acceptance criteria**

- Define APIs to register and revoke device push tokens.
- Store notifications scoped to the correct account and profile.
- Connect due medication schedules to notification delivery and make dispatch idempotent.
- Test ownership boundaries, retries, revoked tokens, and timezone/date boundaries.

### 7. [Backend][Auth/Profile] Add session and ownership contract tests

**New**

**Description:** Add dedicated API tests for authentication and profile ownership. There are no dedicated `test_auth_api.py` or `test_profiles_api.py` files today.

**Acceptance criteria**

- Cover signup, verification, login, invalid/expired sessions, and session expiry.
- Verify one account cannot read or mutate another account's profiles, vault records, schedules, or notifications.
- Cover malformed payloads and expected error responses.
- Keep tests isolated from production credentials and data.

### 8. [Backend/OCR] Make benchmark stages real and improve measured accuracy

**New**

**Description:** The OCR benchmark runner requests stages that the API does not expose, so the checked-in report marks stage results unconfirmed.

**Acceptance criteria**

- Implement the requested stage selector or remove/rename unsupported stage comparisons; only report confirmed runs.
- Use reviewed labels and resolve all placeholders in the benchmark manifest.
- Track entity and dosage accuracy, unsafe-high-trust rate, and latency.
- Agree on a truthful baseline and release thresholds; publish reproducible benchmark results.

## QA and quality

### 9. [QA] Build a web and Expo Go end-to-end regression matrix

**Related:** #27, #30

**Description:** Extend the existing manual QA effort with repeatable end-to-end coverage across the browser and Android Expo Go.

**Acceptance criteria**

- Cover login/session expiry, offline or slow backend, camera/gallery upload, valid/invalid images, no match, low/medium/high confidence, retry, and save flows.
- Verify successful navigation and cleanup of processing state on both success and failure.
- Record device/browser, steps, expected and actual results, severity, and relevant logs.
- Keep this as a separate issue from #27's docs-only work.

### 10. [QA] Review and complete the OCR benchmark dataset

**New; pairs with task 8**

**Description:** Audit image fixtures and expected labels so OCR quality measurements are trustworthy.

**Acceptance criteria**

- Have a reviewer verify each image and ground-truth label.
- Resolve `TODO_FILL_ME` and document ambiguous or excluded labels.
- Add representative blurry, low-light, cropped, combination-product, and dosage-conflict cases.
- Re-run the benchmark and publish the reviewed results.

### 11. [QA/Frontend] Add an automated frontend test harness for scan behavior

**New**

**Description:** Add automated tests for the scan client and result UI; there is currently no frontend test script or test suite.

**Acceptance criteria**

- Add a test command and test runner compatible with the Expo/React Native project.
- Test `scanApi` request construction, response normalization, and error handling.
- Test that FDA Match remains distinct from safety trust and that low/medium/high tiers produce the correct banner styling.
- Run the tests in CI.

### 12. [Quality/CI] Restore frontend lint/typecheck and add pull-request gates

**New**

**Description:** Frontend checks currently fail, leaving no clean quality baseline for future work.

**Acceptance criteria**

- Resolve the current ESLint errors and warnings, including React ref/effect rule violations and JSX text errors.
- Resolve existing TypeScript diagnostics in shared React Native components and hooks.
- Make `npm run lint` and `npx tsc --noEmit` pass.
- Add a GitHub Actions workflow to run frontend lint/typecheck and backend pytest on pull requests.

## Additional recommended tasks

### 13. [Privacy][Frontend/Backend] Make OCR diagnostics safe for production

**New**

**Description:** The scan screen and OCR endpoint currently log scan results, telemetry, extracted label data, and suggested medicine details. Keep useful local debugging while avoiding unnecessary exposure of health-related data.

**Acceptance criteria**

- Keep detailed OCR output available only in an explicit development/debug mode.
- Redact raw OCR text, medicine names/dosages, account identifiers, and tokens from production logs.
- Use structured diagnostic events with request IDs and aggregate timings for production troubleshooting.
- Add tests or checks that production logging does not emit raw label text or credentials.

### 14. [Expo Go][Frontend/Backend] Fix mobile access to the development app

**Related:** #27; follows the reported behavior where the app works in the laptop browser but not in Expo Go.
**Status:** Completed (Issue #47)

**Description:** Fix the mobile development path so Expo Go on a physical Android phone can reach both the MediScan app and its backend. The laptop browser currently works, but the phone cannot reliably use the local API.

**Acceptance criteria**

- [x] Verify Expo Go resolves the laptop's active LAN address and uses a reachable API URL; do not use `localhost` for a physical phone.
- [x] Ensure FastAPI listens on a LAN-reachable interface during local Expo Go development and document the required same-Wi-Fi/firewall setup without opening access on public networks.
- [x] Confirm login, authenticated API requests, profile loading, and OCR image upload work from a physical Android device using Expo Go.
- [x] Keep laptop-browser behavior working and preserve the production API URL/configuration.
- [x] Add a concise mobile connectivity smoke-test checklist and actionable diagnostics for an unset or unreachable API URL.

### 15. [Backend/QA] Test database backup and restore from a clean environment

**New**

**Description:** Verify the documented database snapshot and setup flow can restore a clean development database without relying on an existing local database state.

**Acceptance criteria**

- Restore the committed database snapshot into a fresh PostgreSQL instance using documented steps.
- Verify core account, profile, medicine, vault, and schedule schema/data relationships after restore.
- Check that backup/restore procedures do not include credentials or real user health data.
- Document how schema changes are reflected in the snapshot and how to recover from a failed restore.

### 16. [Accessibility/QA] Audit screen-reader, keyboard, and large-text behavior

**Related:** #24, #32

**Description:** Extend the current theme and global text-size work with a cross-platform accessibility pass.

**Acceptance criteria**

- Verify primary flows using Android TalkBack and keyboard navigation on web.
- Verify large system/app text does not clip buttons, dialogs, result banners, forms, or navigation.
- Check text/background contrast in light and dark themes and ensure status is not communicated by color alone.
- Add accessible labels and state announcements for camera, upload, scan progress, reminders, and verification actions.
- Record platform, steps, expected/actual behavior, and severity for each finding.

### 17. [Backend/QA] Prevent duplicate medicine choices in scan results

**New**

**Description:** Some scans show the same medicine more than once as a selectable match (for example, duplicate Solmux entries). Determine whether equivalent FDA catalog rows are being returned as separate choices and deduplicate them without hiding genuinely different products.

**Acceptance criteria**

- Define product identity using brand, ingredients, dosage form, strength, and manufacturer; do not merge products that differ in these clinically relevant details.
- Return at most one selectable result for equivalent FDA records while preserving the best available match details.
- Add backend regression tests using duplicate FDA records and cases that must remain distinct.
- Verify scan results show no duplicate choices on web and Expo Go.

### 18. [Frontend/QA] Fix Vault screen crashes that return users to login

**Related:** #26

**Description:** Opening or using the Vault can crash or refresh the app and send the user back to login. Identify and fix the triggering UI/runtime error without masking it by changing authentication behavior.

**Acceptance criteria**

- Reproduce and document the failure path, platform, and error before fixing the root cause.
- Verify the Vault opens and medicine-card actions work with populated, empty, and recoverable-error states.
- Confirm a Vault failure does not reload the app, clear the active session, or redirect the user to login.
- Test the affected flow on web and Expo Go, including the medicine-card menu and accessibility behavior.

## Suggested sequencing

1. Redact production OCR diagnostics and establish the lint/typecheck baseline early.
2. Backend upload contract → frontend scan recovery → QA scan matrix.
3. QA benchmark label review → backend benchmark implementation and results.
4. Backend consent/notification APIs → corresponding frontend work → QA acceptance.
5. Deduplicate scan matches and stabilize Vault navigation before release regression.
6. Verify database restore and local-network smoke tests before releases.
