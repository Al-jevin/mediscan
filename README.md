# MediScan Vault

MediScan Vault is a mobile app that scans medicine boxes and blister packs using your phone camera, validates the medicine against the Philippine FDA database, and helps families track medication schedules.

---

## Quick Overview: How the System Works

* **PostgreSQL Database (Port 5432):** Stores FDA medicine records, user accounts, profiles, and reminders. Running it via Docker Desktop (WSL 2) is the easiest method.
* **FastAPI Backend (Port 8000):** Runs OCR (PaddleOCR) and NER medicine-matching logic. Must listen on `--host 0.0.0.0` so physical phones can reach it.
* **Expo Mobile App (Port 8081):** Runs on your computer via Metro bundler and opens on your physical phone through the **Expo Go** app.

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

*(Note: In `front-end/.env`, dynamic IP resolution is enabled by default so your phone connects automatically on any Wi-Fi or Hotspot).*

---

## Step 3: One-Time Windows Firewall Rule (Allows Phone Access)

By default, Windows Firewall blocks incoming connections from physical phones. Run this **once** to permanently allow your phone to talk to FastAPI:

Open **PowerShell as Administrator** and run:
```powershell
netsh advfirewall firewall add rule name="MediScan Port 8000" dir=in action=allow protocol=TCP localport=8000
```
*(You will see `Ok.` You can delete this rule after defense day with `netsh advfirewall firewall delete rule name="MediScan Port 8000"`).*

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

### Terminal 2: Start Mobile App
```powershell
cd front-end
npx expo start -c
```
* **On Phone:** Open **Expo Go** and scan the QR code.
* **On Laptop Browser:** Press **`w`** in the terminal or open `http://localhost:8081`.

---

## 🏆 Defense Day Protocol (Saturday Bulletproof Setup)

University/campus Wi-Fi networks frequently block device-to-device communication (AP Client Isolation). To guarantee a 100% reliable defense presentation:

1. **Turn on Mobile Hotspot on your phone.**
2. **Connect your laptop to your phone's hotspot Wi-Fi.**
3. In Windows Settings -> **Network & internet** -> **Wi-Fi**, ensure the hotspot connection is set to **Private network**.
4. Start database & backend in Terminal 1 (`python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000`).
5. Start frontend in Terminal 2 (`npx expo start -c`).
6. Scan the QR code in Expo Go!

**Why this works:** The phone and laptop communicate directly over their own private network (`192.168.43.x` or `10.x.x.x`). The app automatically discovers the new IP with **zero manual configuration**, and does not rely on venue Wi-Fi.

---

## Common Errors & Quick Solutions

### 1. Phone says: "Could not connect to backend..."
* **Cause A:** Backend was started without `--host 0.0.0.0`. Ensure you use `--host 0.0.0.0 --port 8000`.
* **Cause B:** Wi-Fi is set to "Public" in Windows. Switch it to **Private network** in Windows Settings -> Network & Internet -> Wi-Fi.
* **Cause C:** Windows Firewall blocked port 8000. Run the `netsh advfirewall` command from Step 3 as Administrator.

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

---

## Team Git Workflow Rules

1. **Never push directly to `main`.** Work on your feature branch and submit a Pull Request.
2. **Keep the database running when running `git commit`.** Our git hooks automatically back up the database into `mediscan_full.sql` on each commit.
3. **Commit your local changes before running `git pull`.**
