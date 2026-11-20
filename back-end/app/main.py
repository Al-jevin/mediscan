"""Primary FastAPI application entry point."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
REPOSITORY_DIRECTORY = Path(__file__).resolve().parents[2]

load_dotenv(BACKEND_DIRECTORY / ".env")
load_dotenv(REPOSITORY_DIRECTORY / ".env")

from api.router import router
from api.v1.crud_tester import router as crud_tester_router

app = FastAPI()

configured_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
cors_origins = [
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(crud_tester_router)

def _lan_ipv4_addresses() -> list[str]:
    """Prefer the outbound/Wi-Fi address Metro uses; skip VirtualBox/WSL host-only NICs."""
    import socket

    preferred: list[str] = []
    others: list[str] = []

    # Route trick: OS picks the NIC used for general outbound traffic (usually Wi-Fi/Ethernet).
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            route_ip = sock.getsockname()[0]
        if route_ip and not route_ip.startswith("127."):
            preferred.append(route_ip)
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip or ip.startswith("127."):
                continue
            # VirtualBox Host-Only / similar adapters Windows often returns first via gethostbyname.
            if ip.startswith("192.168.56."):
                others.append(ip)
            elif ip not in preferred:
                preferred.append(ip)
    except OSError:
        pass

    ordered: list[str] = []
    for ip in preferred + others:
        if ip not in ordered:
            ordered.append(ip)
    return ordered


@app.on_event("startup")
async def startup_event():
    try:
        lan_ips = _lan_ipv4_addresses()
        print("\n" + "=" * 55, flush=True)
        print(" [MediScan Backend] Server running on all interfaces", flush=True)
        print(" -> Localhost (Browser): http://127.0.0.1:8000/docs", flush=True)
        if lan_ips:
            primary = lan_ips[0]
            print(f" -> Mobile LAN (Expo Go): http://{primary}:8000/docs", flush=True)
            for extra in lan_ips[1:]:
                print(f" -> Also reachable at:     http://{extra}:8000/docs", flush=True)
        else:
            print(" -> Mobile LAN: could not detect a LAN IP (still listening on 0.0.0.0)", flush=True)
        print("=" * 55 + "\n", flush=True)
    except Exception:
        pass

CRUD_TESTER_DIRECTORY = REPOSITORY_DIRECTORY / "front-end"
app.mount(
    "/crud-tester",
    StaticFiles(directory=CRUD_TESTER_DIRECTORY, html=True),
    name="crud-tester",
)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)