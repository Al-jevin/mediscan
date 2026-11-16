# MediScan Vault

MediScan Vault is a mobile app that scans medicine boxes and blister packs using your phone camera, checks the medicine against the Philippine FDA database, and helps families track medication schedules.

---

## Choose How You Want to Run the Backend

You have two ways to set up the backend and database on your computer:
* *Option A: Docker Setup (Recommended on Windows)* — Runs the backend and database inside containers so you do not have to install PostgreSQL manually or deal with Windows Python/DLL errors.
* *Option B: Manual Local Setup* — Installs PostgreSQL and Python 3.11 directly on your machine.

(Regardless of which option you pick for the backend, the **Expo mobile app* always runs directly on your computer so your phone can connect to it over Wi-Fi.)*

---

## Step 1: Download the Code and .env Files (Required for Both Options)

### 1. Clone the Repo and Switch to the OCR Branch
Open your terminal (WSL2 Ubuntu or PowerShell) and run:
git clone <your-repo-url>
cd mediscan
git switch feat/ocr-ner-hardening

### 2. Download and Place the Two .env Files
Ask the team lead (or check the team group chat) to download the two .env files, then place them in these exact folders:
1. Place the **backend .env file** directly in the *main project folder (root)* (mediscan/.env).
2. Place the **frontend .env file** inside the **front-end/** folder (mediscan/front-end/.env).

*(Do not commit or upload .env files to GitHub.)*

---

## Option A: Docker Setup (Easiest)

### What You Need Installed
1. *Docker Desktop* (make sure Docker Desktop is open and running before running commands)
2. *Node.js (LTS version)*
3. *Expo Go* app installed on your phone

### First-Time Docker Setup & Daily Run
1. Open the .env file in your *root* folder (mediscan/.env) and make sure DATABASE_URL uses db instead of localhost:
   
dotenv
   DATABASE_URL=postgresql://mediscan_admin:mediscan_P%40ssw0rd@db:5432/mediscan_db
   
2. From the main mediscan folder, build and start the backend + database containers:
   
   docker compose up --build -d
   
3. Load the starter database (mediscan_full.sql) into the running database container (replace <db-container-name> with the container name shown in docker ps):
   
   docker exec -i <db-container-name> psql -U mediscan_admin -d mediscan_db < mediscan_full.sql
   
4. Check that the backend is live by opening http://127.0.0.1:8000/docs in your browser.
5. Install and start the mobile app in your terminal:
   
   cd front-end
   npm install
   npx expo start -c
   

### Useful Docker Commands
# View backend logs
docker compose logs -f

# Stop all containers when done
docker compose down

# Rebuild after someone updates back-end/requirements.txt
docker compose up --build -d

---

## Option B: Manual Local Setup (Without Docker)

### What You Need Installed
1. *Python 3.11 (64-bit)* — Do not use Python 3.12+ or 32-bit Python, or the OCR library will fail to install.
2. *Node.js (LTS version)*
3. *PostgreSQL (version 14 or newer)*
4. *Expo Go* app installed on your phone

### Part 1: First-Time Local Setup (Do This Once)

#### 1. Check Your Root .env File
Open the .env file in your *root* folder (mediscan/.env) and make sure DATABASE_URL uses localhost:
dotenv
DATABASE_URL=postgresql://mediscan_admin:mediscan_P%40ssw0rd@localhost:5432/mediscan_db

#### 2. Set Up PostgreSQL (mediscan_db)
Start PostgreSQL and load mediscan_full.sql from the main mediscan folder:

*WSL2 (Ubuntu) / Mac / Linux:*
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER mediscan_admin WITH PASSWORD 'mediscan_P@ssw0rd' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE mediscan_db OWNER mediscan_admin;"
PGPASSWORD="mediscan_P@ssw0rd" psql -U mediscan_admin -h localhost -d mediscan_db -f mediscan_full.sql

*Windows PowerShell:*
Start-Service postgresql*
psql -U postgres -c "CREATE USER mediscan_admin WITH PASSWORD 'mediscan_P@ssw0rd' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE mediscan_db OWNER mediscan_admin;"
$env:PGPASSWORD="mediscan_P@ssw0rd"; psql -U mediscan_admin -h localhost -d mediscan_db -f mediscan_full.sql

#### 3. Install Backend Python Packages
From the main mediscan folder:

*WSL2 (Ubuntu) / Mac / Linux:*
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r back-end/requirements.txt

*Windows PowerShell:*
# Run this first line once so Windows allows you to activate Python environments:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r back-end\requirements.txt

#### 4. Install Mobile App Packages
From the main mediscan folder:
cd front-end
npm install

### Part 2: How to Run Locally Every Day

Open *two terminal windows* in the main mediscan folder:

*Terminal 1 — Start Database & Backend:*
# WSL2 / Mac / Linux:
sudo service postgresql start
source .venv/bin/activate
cd back-end/app
python -m uvicorn main:app --reload
# Windows PowerShell:
Start-Service postgresql*
.venv\Scripts\Activate.ps1
cd back-end\app
python -m uvicorn main:app --reload
You will see `Uvicorn running on http://127.0.0.1:8000`. (You can ignore the yellow `failed to import ujson` warning—that is normal.)


*Terminal 2 — Start Mobile App:*
cd front-end
npx expo start -c
Scan the QR code with *Expo Go* on your phone (same Wi-Fi), or press **w** to open it in your browser.

---

## Team Git Rules (Read Before Committing)

1. **Never push directly to main.** Always work on a feature branch (like feat/ocr-ner-hardening) and open a Pull Request on GitHub when done.
2. **Keep PostgreSQL running when you run git commit.** Our repo has an automatic script that backs up your database into mediscan_full.sql every time you commit. If PostgreSQL is turned off, your commit will be blocked.
3. **Commit your changes before running git pull.** Whenever you pull new updates from GitHub, your local database automatically resets to match the team's latest mediscan_full.sql.

---

## Common Errors & Quick Fixes

### 1. Docker says port is already allocated (5432 or 8000)
Your local PostgreSQL or a local Uvicorn server is already using that port. Stop the local service (sudo service postgresql stop or Stop-Service postgresql* in PowerShell) before running docker compose up.

### 2. PowerShell says: Activate.ps1 cannot be loaded because running scripts is disabled
Run this command once in PowerShell, then try activating .venv again:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

### 3. Backend crashes with set_optimization_level or paddlex error
This happens if pip installed PaddleOCR version 3.x instead of 2.x. Run these commands inside your activated .venv to fix it:
pip uninstall -y paddleocr paddlex
pip install "paddleocr==2.9.1" "numpy<2.0" "opencv-python-headless<4.11"

### 4. Windows says: Application Control policy has blocked this file
Windows 11 security sometimes blocks Python files stored inside your Documents folder. Either:
* *Recommended:* Use *Option A (Docker)* or run inside *WSL2 Ubuntu*.
* *Or:* Move your .venv outside Documents (e.g., py -3.11 -m venv C:\venvs\mediscan and activate C:\venvs\mediscan\Scripts\Activate.ps1).

### 5. Phone app cannot connect to the backend over Wi-Fi
If running manually without Docker, python -m uvicorn main:app --reload only listens on your laptop (127.0.0.1). To test on a physical phone over Wi-Fi, run python -m uvicorn main:app --host 0.0.0.0 --reload, and if Windows Firewall blocks port 8000, run this once in *PowerShell as Administrator*:
New-NetFirewallRule -DisplayName "MediScan Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Any
127.0.0.1