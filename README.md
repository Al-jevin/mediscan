# MediScan Vault

MediScan Vault is a mobile app that scans medicine boxes and blister packs using your phone camera, validates the medicine against the Philippine FDA database, and helps families track medication schedules.

---

## Quick Overview: How the System Works

* **PostgreSQL Database (Port 5432):** Stores FDA medicine records, user accounts, profiles, and reminders. Running it via Docker Desktop (WSL 2) is the easiest method.
* **FastAPI Backend (Port 8000):** Runs OCR (PaddleOCR) and NER medicine-matching logic. Must listen on `--host 0.0.0.0` so it accepts connections from the laptop and Metro.
* **Expo Mobile App (Port 8081):** Metro serves the app **and** proxies `/api/*` to the backend. Expo Go talks to Metro only, so the phone does not need a direct path to port 8000.

---

## Prerequisites (Install These First)

1. **[Node.js (LTS Version)](https://nodejs.org/)** — For running the Expo frontend.
2. **[Python 3.11 (64-bit)](https://www.python.org/downloads/release/python-3119/)** — For the FastAPI backend. *(Do not use Python 3.12+ or 32-bit Python, or PaddleOCR will fail to install).*
3. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — For running the PostgreSQL database with zero configuration.
4. **[Expo Go app](https://expo.dev/go)** installed on your Android/iOS phone.

---

## Step 1: Install WSL 2 & Docker Desktop (For Windows)

Running Docker through WSL 2 (Windows Subsystem for Linux) gives the best performance and prevents Windows file/path issues.

### 1. Install WSL 2 (Do this once)
Open **PowerShell as Administrator** and run:
```powershell
wsl --install
```
*If your computer asks you to restart, restart your computer to finish installation.*

### 2. Configure Docker Desktop for WSL 2
1. Download and install **Docker Desktop for Windows**.
2. Open Docker Desktop, click the **Settings (gear icon)** at the top right:
   * Under **General**, check **Use the WSL 2 based engine**.
   * Under **Resources** -> **WSL Integration**, make sure integration with your default WSL distro is enabled.
3. Click **Apply & restart**. Make sure Docker Desktop is running in the background.

---

## Step 2: Clone the Project & Set Up `.env` Files

### 1. Clone the repository and switch to the development branch:
```powershell
git clone <your-repo-url>
cd mediscan
git switch feat/ocr-ner-hardening
```

### 2. Place the two `.env` files:
Get the `.env` files from your team lead / group chat:
1. **Backend `.env`:** Place directly in the project root: `mediscan/.env`
2. **Frontend `.env`:** Place inside the `front-end` folder: `mediscan/front-end/.env`

*(In `front-end/.env`, leave `EXPO_PUBLIC_API_URL` commented out. Expo Go discovers the laptop IP from Metro automatically.)*

---

## Step 3: One-Time Windows Network Tips (Phone Access)

Expo Go normally reaches the API through Metro on port **8081** (already open when Expo is running).

Still do these once so defense day / hotspot is reliable:

1. In Windows Settings -> **Network & internet** -> **Wi-Fi**, set your connection to **Private network**.
2. (Optional) Allow direct backend access on port 8000 — useful for APK builds or if you bypass Metro:

Open **PowerShell as Administrator** and run:
```powershell
netsh advfirewall firewall add rule name="MediScan Port 8000" dir=in action=allow protocol=TCP localport=8000
```

If login still times out on **Public** Wi‑Fi (Windows may block `python.exe` even with the rule above), run this elevated script once:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\fix-python-public-firewall.ps1
```

---

## Step 4: First-Time Setup (Do Once)

### 1. Start the PostgreSQL Database (via Docker)
From the main `mediscan` folder:
```powershell
docker compose up -d
```
*(Docker will automatically start the database container and pre-load `mediscan_full.sql`).*

### 2. Set Up the Python Backend Virtual Environment
From the main `mediscan` folder:
```powershell
# Allow running PowerShell scripts (if prompted):
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Create virtual environment with Python 3.11:
py -3.11 -m venv .venv

# Activate environment:
.venv\Scripts\Activate.ps1

# Install requirements:
python -m pip install --upgrade pip
pip install -r back-end\requirements.txt
```

### 3. Install Mobile App Dependencies
From the main `mediscan` folder:
```powershell
cd front-end
npm install
cd ..
```

### 4. Install Git hooks (keeps `mediscan_full.sql` in sync)
Hooks live in `.githooks/` (not `.git/hooks`). After clone / on a new machine:

```sh
sh scripts/install-git-hooks.sh
```

`front-end` `npm install` also sets `core.hooksPath` via `postinstall`. Pre-commit dumps Postgres into `mediscan_full.sql` (Docker, PATH, Windows PostgreSQL, or WSL). If dump fails, the commit is aborted with a clear error—start Docker/`docker compose up -d` first.

---

## Step 5: How to Run the App Every Day

Open **two terminal windows** in the main `mediscan` folder:

### Terminal 1: Start Database & Backend
```powershell
# 1. Ensure Docker database is running:
docker compose up -d

# 2. Activate Python environment & run backend:
.venv\Scripts\Activate.ps1
cd back-end\app
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
You will see our startup banner:
```text
=======================================================
 [MediScan Backend] Server running on all interfaces
 -> Localhost (Browser): http://127.0.0.1:8000/docs
 -> Mobile LAN (Expo Go): http://<your-laptop-ip>:8000/docs
=======================================================
```
*(The Mobile LAN line should match your Wi‑Fi/hotspot IP — the same one Metro shows.)*

### Terminal 2: Start Mobile App
```powershell
cd front-end
npm run start:go
```
* **On Phone:** Open **Expo Go** and scan the QR code. Phone and laptop must be on the **same Wi‑Fi or hotspot**.
* **On Laptop Browser:** Press **`w`** in the terminal or open `http://localhost:8081`.

The app calls `http://<laptop-ip>:8081/api/v1/...`. Metro forwards those requests to FastAPI on port 8000.

---

## Defense Day Protocol (Hotspot Setup)

Campus Wi‑Fi often blocks phone ↔ laptop traffic. Use your phone hotspot instead:

1. **Turn on Mobile Hotspot on your phone.**
2. **Connect your laptop to that hotspot.**
3. In Windows Settings -> **Network & internet** -> **Wi‑Fi**, set the hotspot network to **Private**.
4. Start backend (Terminal 1) and Expo (Terminal 2) as in Step 5.
5. Scan the QR code in Expo Go.

No manual IP editing is needed — Expo Go follows Metro’s host, and Metro proxies the API.

---

## Common Errors & Quick Solutions

### 1. Phone says: "Request timed out" / "Could not connect to backend..."
* **Cause A:** Backend was started without `--host 0.0.0.0`. Use `--host 0.0.0.0 --port 8000`.
* **Cause B:** Metro was started before `metro.config.js` existed, or port 8081 is stale. Stop Expo, then run `npm run start:go` again and reload the app.
* **Cause C:** Phone and laptop are on different networks. Use the same Wi‑Fi, or the hotspot protocol above.
* **Cause D:** Windows Public network is blocking Python (less common now that Expo Go uses the Metro proxy). Set Wi‑Fi to **Private**, or run `scripts\fix-python-public-firewall.ps1` as Administrator.

### 2. Docker says: "port is already allocated (5432)"
Another PostgreSQL instance is running locally on your computer. Stop it in PowerShell before running Docker:
```powershell
Stop-Service postgresql*
docker compose up -d
```

### 3. PowerShell says: "Activate.ps1 cannot be loaded because running scripts is disabled"
Run this command once in PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 4. PaddleOCR installation error (`set_optimization_level` or `paddlex`)
Run inside your activated `.venv`:
```powershell
pip uninstall -y paddleocr paddlex
pip install "paddleocr==2.9.1" "numpy<2.0" "opencv-python-headless<4.11"
```

### 5. Expo Go shows a blue "Something went wrong" screen
Reload after a clean Metro start (`npm run start:go`). Push notification code loads safely in Expo Go; remote push tokens still need a real APK/dev build.

---

## Team Git Workflow Rules

1. **Never push directly to `main`.** Work on your feature branch and submit a Pull Request.
2. **Keep the database running when running `git commit`.** Our git hooks automatically back up the database into `mediscan_full.sql` on each commit.
3. **Commit your local changes before running `git pull`.**
