"""Primary FastAPI application entry point."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

REPOSITORY_DIRECTORY = Path(__file__).resolve().parents[2]
load_dotenv(REPOSITORY_DIRECTORY / ".env")

from api.router import router
from api.v1.crud_tester import router as crud_tester_router

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

app = FastAPI()
configured_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
cors_origins = [
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
] or [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://192.168.1.14:8081",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1")
app.include_router(crud_tester_router)

CRUD_TESTER_DIRECTORY = REPOSITORY_DIRECTORY / "front-end"
app.mount(
    "/crud-tester",
    StaticFiles(directory=CRUD_TESTER_DIRECTORY, html=True),
    name="crud-tester",
)
