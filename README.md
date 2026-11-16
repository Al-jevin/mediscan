# MediScan Vault

Offline-first medicine OCR scanner, family profile manager, and medication reminder platform built with *React Native (Expo)* and *FastAPI + PostgreSQL*.

### What's New on feat/ocr
- *Image Conditioning & Spatial Ranking:* Added image_preprocess.py (1280px edge cap, LAB L-channel CLAHE glare reduction, bilateral filtering, 70% high-res center-ROI fallback) and bounding-box prominence tagging ($R_i = h_i / \max(h)$) in vision.py.
- *Distractor Quarantine & Safety Trust Caps:* Strips FDA registration numbers (DR-*), lot/expiry codes, and tablet counts before dosage extraction; caps TrustScore below 0.85 on dosage conflicts (UASR = 0.0%).
- *Live Scan Telemetry & 3-Stage Benchmark:* Added ScanTelemetryDrawer in Expo (result.tsx) and back-end/tests/run_benchmark.py (?stage=0|1|2).

---

## 1. Quickstart (Existing Setup)

If you already have PostgreSQL and your .env files configured, run these steps from the repository root:

# 1. Sync branch (make sure PostgreSQL is running first)
git fetch origin
git switch feat/ocr
git pull origin feat/ocr

# 2. Install updated backend dependencies & start FastAPI from back-end/app
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r back-end/requirements.txt
cd back-end/app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Install & start Expo frontend (in a new terminal from repo root)
cd front-end
npm install
npx expo start -c

Verify the API docs at http://127.0.0.1:8000/docs, then press w in Expo for web or scan the QR code in *Expo Go* on your phone.

---

## 2. First-Time Setup

### Prerequisites
- *Node.js* (LTS) & *npm*
- *Python 3.10+*
- *PostgreSQL 14+*
- *Expo Go* on iOS/Android (for physical device testing)

### Step A: Create Local .env Files
Do *not* commit .env files. Ask the team lead for the shared SECRET_KEY and BREVO_API_KEY.

**back-end/.env**
dotenv
DATABASE_URL=postgresql://mediscan_admin:mediscan_P%40ssw0rd@localhost:5432/mediscan_db
SECRET_KEY=replace_with_local_secret_key
BREVO_API_KEY=replace_with_team_brevo_key
CORS_ALLOWED_ORIGINS=http://localhost:8081,[http://127.0.0.1:8081](http://127.0.0.1:8081)
ENABLE_CRUD_TEST_API=true

**front-end/.env**
dotenv
# Leave commented out for local dev — front-end/src/services/apiUrl.ts auto-detects localhost and your LAN IP.
# EXPO_PUBLIC_API_URL=[http://127.0.0.1:8000/api/v1](http://127.0.0.1:8000/api/v1)

### Step B: Initialize PostgreSQL (mediscan_db)

#### WSL2 (Ubuntu) / Linux / macOS
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER mediscan_admin WITH PASSWORD 'mediscan_P@ssw0rd' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE mediscan_db OWNER mediscan_admin;"
PGPASSWORD="mediscan_P@ssw0rd" psql -U mediscan_admin -h localhost -d mediscan_db -f mediscan_full.sql

#### Windows PowerShell
Start-Service postgresql*
psql -U postgres -c "CREATE USER mediscan_admin WITH PASSWORD 'mediscan_P@ssw0rd' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE mediscan_db OWNER mediscan_admin;"
$env:PGPASSWORD="mediscan_P@ssw0rd"; psql -U mediscan_admin -h localhost -d mediscan_db -f mediscan_full.sql

### Step C: Create Virtual Environment & Install Packages
Run from the repository root:

python3 -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r back-end/requirements.txt

---

## 3. Testing OCR, Telemetry & Benchmarks (feat/ocr)

### Automated Tests & 3-Stage Ablation Benchmark
Run from the repository root with PostgreSQL active:

# Run full backend regression suite (Windows: .\.venv\Scripts\pytest back-end/tests/)
.venv/bin/pytest back-end/tests/

# Run 3-stage ablation benchmark (?stage=0 baseline, ?stage=1 OpenCV, ?stage=2 full)
# Outputs metrics to docs/BENCHMARK_RESULTS.md
.venv/bin/python back-end/tests/run_benchmark.py

### Manual Verification in Expo
1. Scan a medication box or blister pack and tap **View Pipeline Telemetry** below the result card to inspect the raw-vs-grounded text diff, active preprocessing badges, TrustScore breakdown, and stage latencies (ms).
2. Confirm safety gating tiers:
   - **High (>= 0.85):** Green badge — pre-fills FDA match for one-tap confirmation.
   - **Medium (0.65 – 0.84):** Amber badge — prompts user review before saving.
   - **Low (< 0.65):** Red alert — disables auto-save on low clarity or dosage mismatch.

---

## 4. Team Git & Hook Rules

This repo uses tracked hooks in .githooks/ (auto-configured via npm install in front-end/) to keep mediscan_full.sql synced across the team:
- **Never push directly to main.** Work on feature branches (feat/<task>, fix/<task>) and open a Pull Request.
- **Keep PostgreSQL running on git commit.** The pre-commit hook dumps mediscan_db to mediscan_full.sql and aborts if Postgres is stopped.
- **Commit local DB changes before git pull.** The post-merge hook overwrites your local DB with the incoming mediscan_full.sql.
- **Do not commit .githooks/* edits from Windows/GitHub Desktop.** Windows resets file permissions (100755 to 100644); stage hook changes in WSL after running git update-index --chmod=+x .githooks/*.

---

## 5. Troubleshooting & Dev Tools

<details>
<summary><strong>WSL2 Git commits show "Your Name" or ask for a password</strong></summary>

WSL2 uses its own ~/.gitconfig separate from Windows GitHub Desktop. Run this once in WSL2:
git config --global --replace-all user.name "Your Full Name"
git config --global --replace-all user.email "your-github-email@example.com"
If git config user.name inside the repo still prints "Your Name", clear any local override:
git config --local --unset-all user.name && git config --local --unset-all user.email
To share your Windows GitHub login with WSL2:
GCM=$(find "/mnt/c/Program Files/Git" -name "git-credential-manager.exe" 2>/dev/null | head -n 1)
[ -n "$GCM" ] && git config --global credential.helper "$(printf '%q' "$GCM")"
</details>

<details>
<summary><strong>Phone cannot connect to FastAPI over Wi-Fi / Hotspot (Windows Firewall)</strong></summary>

Run once in *PowerShell as Administrator* to allow inbound traffic on port 8000:
New-NetFirewallRule -DisplayName "FastAPI WSL" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Any
</details>

<details>
<summary><strong>OpenCV import conflicts (cv2 errors)</strong></summary>

Ensure only opencv-python-headless is installed (do not mix opencv-python and opencv-python-headless in the same .venv):
pip uninstall -y opencv-python opencv-python-headless && pip install opencv-python-headless
</details>

<details>
<summary><strong>MediScan CRUD Tester (Local Dev Workbench)</strong></summary>

With ENABLE_CRUD_TEST_API=true in back-end/.env and FastAPI running, open http://127.0.0.1:8000/crud-tester/ (loopback-only) to test CRUD operations across accounts, profiles, FDA medicines, schedules, and vault items using disposable local data.
</details>