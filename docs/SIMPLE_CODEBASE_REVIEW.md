# MediScan Vault — Simple Codebase Review

*Written for first-year CS students. No jargon wall. Big picture first.*

---

## What is this app?

**MediScan Vault** is a phone app that:

1. Lets you take a photo of a medicine label  
2. Reads the text in the photo  
3. Looks up that medicine in a Philippine FDA list  
4. Saves it in a “vault” and can remind you to take it  

Think of it as: **camera → text → search → save → reminder**.

---

## The three big pieces

```
[ Phone app ]  ----asks---->  [ Backend server ]  ----reads/writes---->  [ Database ]
   Expo / JS                     FastAPI / Python                         PostgreSQL
```

| Piece | Plain English | Port |
| --- | --- | --- |
| **Frontend** | What you see and tap on the phone | `8081` (dev server) |
| **Backend** | The “brain” that does login, OCR, save, reminders | `8000` |
| **Database** | Where accounts, medicines, and reminders are stored | `5432` |

The phone never talks to the database directly. It only talks to the backend. The backend talks to the database. That is normal and safer.

---

## Folder map (repo root)

| Folder | What it is |
| --- | --- |
| `front-end/` | The mobile app (Expo + React Native) |
| `back-end/` | The API server (FastAPI) |
| `docs/` | Notes and guides |
| `scripts/` | Helper scripts |
| `.github/` | Automated checks (CI) when you push code |

---

# Backend (simple review)

## Where it starts

File: `back-end/app/main.py`

This file:

- Creates the FastAPI app  
- Turns on CORS (so the phone/browser is allowed to call the API)  
- Plugs in the routes under `/api/v1`  
- Starts the server (usually on `0.0.0.0:8000`)

**Analogy:** `main.py` is the front door of a school. Routes are the classrooms.

## Routes = URLs the app can call

Folder: `back-end/app/api/v1/`

| File | Job in plain English |
| --- | --- |
| `auth.py` | Sign up, login, logout, verify email |
| `profiles.py` | Family profiles (Mom, Dad, child, …) |
| `ocr.py` | Upload a label photo → get medicine suggestions |
| `vault.py` | Save / edit / delete medicines you keep |
| `schedules.py` | Reminder schedules |
| `notifications.py` | Notification-related endpoints |
| `medicines.py` | Look up FDA medicines |

`api/router.py` is the list that wires these classroom doors together.

## CRUD and services

| Folder | Job |
| --- | --- |
| `back-end/app/crud/` | Talks to the database (create, read, update, delete rows) |
| `back-end/app/services/` | Extra logic (OCR, email, FDA matching, images) |
| `back-end/app/db/` | Database connection pool |
| `back-end/app/schemas/` | Shapes of request/response data (like forms with rules) |

**OCR path (simplified):**

1. Phone sends a photo to `/api/v1/ocr/extract-label`  
2. PaddleOCR reads text from the image  
3. Code finds likely drug name / strength  
4. RapidFuzz compares that text to FDA rows in PostgreSQL  
5. API returns matches with a confidence level (high / medium / low)

## Database

- Engine: **PostgreSQL**  
- Main medicine table: Philippine FDA records (tens of thousands of rows)  
- Also stores: accounts, profiles, vault items, schedules, logs, session tokens  

Secrets and connection info live in `.env` (not committed to Git).

## Backend review notes (gentle)

**What’s good**

- Clear split: routes → services/CRUD → database  
- Auth and ownership checks (you should only see *your* data)  
- Lots of automated tests under `back-end/tests/`

**What’s easy to get wrong as a beginner**

- Forgetting `--host 0.0.0.0` (phone can’t reach `localhost` on the laptop)  
- Changing API shapes without updating the frontend  
- Putting passwords in code (always use `.env`)

---

# Frontend (simple review)

## What tech is this?

- **React Native** = UI for phones using React ideas  
- **Expo** = toolkit that makes RN easier (camera, notifications, Expo Go)  
- **Expo Router** = file-based screens (a file ≈ a screen)

## Where screens live

Folder: `front-end/src/app/`

| Path | What the user sees |
| --- | --- |
| `login.tsx`, `signup.tsx`, `verify-code.tsx` | Account flow |
| `(tabs)/index.tsx` | Home |
| `(tabs)/camera.tsx` | Take / pick a medicine photo |
| `(tabs)/vault.tsx` | Saved medicines |
| `(tabs)/reminders.tsx` | Reminders |
| `(tabs)/profiles.tsx` | Profiles |
| `result.tsx` | Scan result |
| `_layout.tsx` | App shell (theme, menus, providers) |

`(tabs)` means those screens share the bottom tab bar.

## How the phone talks to the backend

Folder: `front-end/src/services/`

| File | Job |
| --- | --- |
| `apiUrl.ts` | Figures out the backend address |
| `scanApi.ts` | Sends the photo for OCR |
| Other `*Api` / auth helpers | Login, vault, reminders, etc. |

`mock/mockAuth.ts` is the auth helper the UI uses; when API mode is on, it calls the real backend.

**Dev networking (simple):**

- Expo Metro (JS bundler) runs on port **8081**  
- Backend runs on port **8000**  
- On a phone, both devices must be on the **same Wi‑Fi or hotspot**  
- In Expo Go, API calls can go through Metro (`/api/...`), which forwards to the backend

## Shared app state

Folder: `front-end/src/context/`

| Context | Remembers |
| --- | --- |
| `ProfileContext` | Who is logged in / active profile |
| `ThemeContext` | Light / dark / text size / language |

## Frontend review notes (gentle)

**What’s good**

- Screens are separated by feature (login, camera, vault, reminders)  
- API calls are not mixed into every button — they go through services  
- Theme and profile are shared from the root layout  

**What’s easy to get wrong as a beginner**

- Hardcoding a laptop IP (it changes on new Wi‑Fi)  
- Forgetting the backend is running when testing login/scan  
- Editing UI and API response fields so they no longer match  

---

## One full example (start to finish)

1. User opens Expo Go and loads the app  
2. User logs in → frontend `POST`s to `/api/v1/...` auth route  
3. Backend checks email/password in PostgreSQL → returns a session token  
4. User opens Camera → takes a photo  
5. Frontend uploads image → backend OCR + FDA match  
6. User saves medicine → backend writes a vault row  
7. User sets a reminder → backend stores a schedule  

If any step fails, check: **Is the backend up? Same network? Token still valid?**

---

## Important files cheat sheet

| File | One-line purpose |
| --- | --- |
| `back-end/app/main.py` | Starts the API server |
| `back-end/app/api/router.py` | Registers API route groups |
| `back-end/app/api/v1/ocr.py` | Scan endpoint |
| `back-end/app/services/fda_matcher.py` | Matches OCR text to FDA rows |
| `back-end/app/db/database.py` | Database connections |
| `front-end/src/app/_layout.tsx` | App root layout |
| `front-end/src/services/apiUrl.ts` | Finds the backend URL |
| `front-end/src/services/scanApi.ts` | Sends scans to the backend |
| `README.md` | How to run the project |

---

## How to “read” this project as a first-year student

1. Run it once (database → backend → Expo) so you see it work  
2. Open one screen (example: `login.tsx`) and find which service it calls  
3. Open that service and find the URL path  
4. Open the matching backend route file and find the function  
5. Follow that function into CRUD/services until you hit SQL / the database  

That path — **UI → service → API → CRUD → DB** — is the whole architecture.

---

## Tiny glossary

| Word | Meaning |
| --- | --- |
| **API** | A menu of URLs the app can call |
| **Endpoint** | One URL + action (GET/POST/…) |
| **CRUD** | Create, Read, Update, Delete |
| **OCR** | Software that reads text from a picture |
| **Token** | A temporary “pass” proving you logged in |
| **Fixture / test** | Automated check that code still works |

---

*This is a learning review, not a grade. It explains how the system is built today so new teammates can find their way around.*
