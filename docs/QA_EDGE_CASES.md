# MediScan QA Edge Cases

Manual edge-case catalog for core flows. Record device/browser, steps, expected vs actual, severity, and logs when filing defects.

## Auth and session

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| A1 | Offline login | Disable network, submit login | Clear error; no crash |
| A2 | Slow backend | Throttle API to ~5s, login | Loading state; success or timeout message |
| A3 | Expired session | Use stale bearer, open Vault | Redirect/prompt to login |
| A4 | Invalid OTP | Enter wrong 6-digit code | 400; throttle after repeated attempts |

## OCR / scan

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| O1 | Blurry label | Capture out-of-focus photo | Low trust / retry guidance |
| O2 | Low light | Dim lighting scan | May fail OCR; recoverable error |
| O3 | Cropped packaging | Partial brand only | Medium/low confidence or no match |
| O4 | Unsupported type | Upload GIF/WEBP spoof | 415; OCR not invoked |
| O5 | Oversized image | >10 MiB upload | 413 |
| O6 | Duplicate catalog rows | Scan product with twin FDA rows | One selectable choice |

## Vault and notifications

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| V1 | Empty vault | New profile, open Vault | Empty state copy |
| V2 | Populated vault | Save verified medicine | Card appears; no nested-button console error |
| N1 | Empty notifications | No schedules | Empty feed |
| N2 | Due reminders | Active daily schedule | Feed + local push (permission granted) |
| N3 | Permission denied | Deny notification OS prompt | No crash; feed still loads |

## Profiles and settings

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| P1 | Rapid profile switch | Switch profiles quickly | Data scoped to active profile |
| S1 | Dark mode persist | Set Dark, reload app | Dark surfaces/text persist |
| S2 | Filipino language | Set Filipino, open Settings | Translated preference labels |
| S3 | Text size global | Raise text size, open Home/Vault | ThemedText scales app-wide |

## Severity guide

- **S0** Crash / data loss
- **S1** Wrong medicine / unsafe trust
- **S2** Feature broken, workaround exists
- **S3** Cosmetic / copy
