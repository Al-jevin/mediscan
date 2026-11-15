# MediScan Vault

Offline-first medicine OCR scanner, family profile manager, and medication reminder platform built with **React Native (Expo)** and **FastAPI + PostgreSQL**.

---

## Prerequisites

Ensure the following are installed before starting:
- **Node.js** (LTS) & **npm**
- **Python 3.10+**
- **PostgreSQL 14+** (via WSL2 Ubuntu or native Windows/macOS)
- **Expo Go** on your mobile device (for physical device testing)

---

## 1. Git Identity & Authentication Setup (WSL2 & Windows)

WSL2 Ubuntu maintains its own isolated `~/.gitconfig` separately from Windows and GitHub Desktop (`C:\Users\<user>\.gitconfig`). Even if you are already signed into GitHub Desktop on Windows, commits made in WSL2 will appear as `"Your Name"` (unlinked to your GitHub profile) and `git push` will ask for a password unless you configure WSL2 Git first.

### Option A: WSL2 (Ubuntu)
1. **Set your commit name and GitHub-linked email** (use the exact email on your GitHub account or your `@users.noreply.github.com` address shown in GitHub Desktop under **File → Options → Git**):
   ```bash
   git config --global --replace-all user.name "Your Full Name"
   git config --global --replace-all user.email "your-github-email@example.com"
   ```
   Verify inside the repository folder that no local `.git/config` override is blocking your global identity:
   ```bash
   git config user.name && git config user.email
   ```
   *(If `user.name` still outputs `"Your Name"`, run `git config --local --unset-all user.name && git config --local --unset-all user.email` inside the repo root.)*

2. **Link WSL2 Git to GitHub** so `git push` authenticates without prompting for a password (pick one):
   - **Share your Windows GitHub login (fastest):**
     ```bash
     GCM=$(find "/mnt/c/Program Files/Git" -name "git-credential-manager.exe" 2>/dev/null | head -n 1)
     [ -n "$GCM" ] && git config --global credential.helper "$(printf '%q' "$GCM")"
     ```
   - **Or authenticate directly via GitHub CLI (`gh`):**
     ```bash
     sudo apt update && sudo apt install -y gh && gh auth login
     ```
     Select **`GitHub.com`** → **`HTTPS`** → **`Yes`** → **`Login with a web browser`**.

### Option B: Windows (GitHub Desktop / PowerShell)
- Sign in to **GitHub Desktop** (**File → Options → Accounts**) and confirm your name and `@users.noreply.github.com` email are populated under **File → Options → Git**.

---

## 2. Environment Variables Setup

Do **not** commit `.env` files to the repository. Create local `.env` files from the templates below and fill in any private API keys shared by the team lead.

### Root / `back-end/.env`
```dotenv
DATABASE_URL=postgresql://mediscan_admin:mediscan_P%40ssw0rd@localhost:5432/mediscan_db
SECRET_KEY=replace_with_local_secret_key
BREVO_API_KEY=replace_with_team_brevo_key
CORS_ALLOWED_ORIGINS=http://localhost:8081,[http://127.0.0.1:8081](http://127.0.0.1:8081)
ENABLE_CRUD_TEST_API=true
```

### `front-end/.env`
```dotenv
# Keep commented out during local development.
# front-end/src/services/apiUrl.ts automatically detects localhost (web) and your laptop's active LAN IP (Expo Go) across any Wi-Fi or hotspot.
# EXPO_PUBLIC_API_URL=[http://127.0.0.1:8000/api/v1](http://127.0.0.1:8000/api/v1)
```

---

## 3. Database & Automated Git Hooks Setup

This repository uses tracked Git hooks in `.githooks/` (compatible with both WSL/Linux/macOS and Git for Windows) to keep `mediscan_db` synchronized across the team:
- **`pre-commit`:** Automatically dumps your local PostgreSQL database to `mediscan_full.sql` (in the repository root) and stages it before every commit.
- **`post-merge`:** Automatically restores `mediscan_full.sql` into your local database whenever you run `git pull`.
- **`pre-push`:** Warns if `mediscan_full.sql` has uncommitted changes before pushing.

### First-Time Database Initialization

Run the commands for your environment from the **repository root**:

#### Option A: WSL2 (Ubuntu) / Linux / macOS
```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER mediscan_admin WITH PASSWORD 'mediscan_P@ssw0rd' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE mediscan_db OWNER mediscan_admin;"
PGPASSWORD="mediscan_P@ssw0rd" psql -U mediscan_admin -h localhost -d mediscan_db -f mediscan_full.sql
```

#### Option B: Windows PowerShell (Native PostgreSQL)
```powershell
# 1. Start the PostgreSQL Windows service if it is not already running (requires Admin):
Start-Service postgresql*

# 2. Create the database user and database (enter your 'postgres' superuser password when prompted):
psql -U postgres -c "CREATE USER mediscan_admin WITH PASSWORD 'mediscan_P@ssw0rd' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE mediscan_db OWNER mediscan_admin;"

# 3. Restore the baseline database from the repository root:
$env:PGPASSWORD="mediscan_P@ssw0rd"; psql -U mediscan_admin -h localhost -d mediscan_db -f mediscan_full.sql
```

> **Important:** PostgreSQL **must** be running whenever you execute `git commit`, or the `pre-commit` hook will abort the commit to prevent stale database states.

---

## 4. Running the Backend (FastAPI)

Navigate to `back-end/`, create a virtual environment, install dependencies, and start Uvicorn bound to all network interfaces (`0.0.0.0`):

#### Option A: WSL2 (Ubuntu) / Linux / macOS
```bash
cd back-end
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000 --reload
```

#### Option B: Windows PowerShell
```powershell
cd back-end
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000 --reload
```
*(If PowerShell blocks `Activate.ps1`, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once and retry.)*

Verify the API is running at `http://127.0.0.1:8000/docs`.

#### Windows Firewall Rule (Required for Physical Phone Testing)
If your phone cannot reach the backend over school/public Wi-Fi or a mobile hotspot, open **PowerShell as Administrator** and run this once to allow port `8000` across all network profiles:
```powershell
New-NetFirewallRule -DisplayName "FastAPI WSL" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Any
```

---

## 5. Running the Frontend (Expo)

Works identically in both **WSL2** and **Windows PowerShell**:

```bash
cd front-end
npm install
npx expo start -c
```

- Running `npm install` automatically configures `git config core.hooksPath .githooks` via the `postinstall` script.
- Press `w` to open the web build in your browser, or scan the QR code with **Expo Go** on your phone (ensure both devices are connected to the same Wi-Fi network or mobile hotspot).

---

## 6. Team Collaboration & Git Workflow Rules

- **Never push directly to `main`.** Create a feature branch (`feat/<task>`, `fix/<task>`, or `docs/<task>`) linked to your assigned GitHub Issue.
- **Respect file ownership boundaries.** Only modify the files explicitly assigned in your GitHub Issue to prevent merge conflicts.
- **Commit local DB changes before pulling.** Because `post-merge` overwrites `mediscan_db` with the incoming `mediscan_full.sql` on `git pull`, always commit your local schema/data changes before pulling updates from `main`.
- **Do not commit edits to `.githooks/*` via GitHub Desktop.** Committing hook files through Windows Git/GitHub Desktop resets their executable mode (`100755` to `100644`) on NTFS. If any hook script is modified, stage and commit it from WSL after running `git update-index --chmod=+x .githooks/*`.

---

## MediScan CRUD Tester (Local Dev Workbench)

A browser workbench for calling the real CRUD functions in `crud_user.py` and `crud_medicine.py` across accounts, profiles, session tokens, FDA medicines, medication schedules, vault items, and medication logs.

1. Ensure PostgreSQL is running and `ENABLE_CRUD_TEST_API=true` is set in your `.env`.
2. Start the FastAPI server (`python -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000 --reload`).
3. Open `http://127.0.0.1:8000/crud-tester/`.

> **Note:** The test API is disabled unless explicitly enabled, rejects non-loopback clients, and directly modifies your local database. Account operations accept raw `password_hash` strings without hashing—use disposable local test data only.