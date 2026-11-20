# Web + Expo Go E2E Regression Matrix

Companion to [QA_EDGE_CASES.md](QA_EDGE_CASES.md). Execute on **Chrome web** and **Android Expo Go**; record browser/device, build, and result.

| Flow | Web | Expo Go | Notes |
| --- | --- | --- | --- |
| Login success | | | |
| Login failure (bad password) | | | |
| Session expiry mid-navigation | | | |
| Offline / backend down banner | | | |
| Camera capture (native only) | N/A | | |
| Gallery PNG/JPEG upload | | | |
| Invalid image type rejected | | | |
| No FDA match path | | | |
| Low confidence banner | | | |
| Medium confidence + vault confirm | | | |
| High confidence save | | | |
| Retry after OCR failure | | | |
| Processing state clears on success | | | |
| Processing state clears on failure | | | |
| Notifications feed loads | | | |
| Local reminder schedules (permission on) | N/A | | |
| Dark mode toggle persists | | | |
| Language toggle updates Settings labels | | | |

## Result legend

- `P` pass
- `F` fail (link issue)
- `B` blocked
- `-` not applicable

## Run log template

```
Date:
Tester:
Web: Chrome <version>
Expo Go: Android <device> / Expo Go <version>
Backend: <commit / URL>
```
