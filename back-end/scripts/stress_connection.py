"""Final connection stress checks that do not require Postgres."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

BACKEND = Path(__file__).resolve().parents[1]
APP = BACKEND / "app"
FIXTURES = BACKEND / "tests" / "fixtures" / "labels"
sys.path.insert(0, str(APP))

from main import app  # noqa: E402


def _font(size: int = 28):
    for name in ("arial.ttf", "calibri.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            pass
    return ImageFont.load_default()


def make_label(text_lines: list[str]) -> bytes:
    img = Image.new("RGB", (800, 280), "white")
    draw = ImageDraw.Draw(img)
    font = _font()
    y = 40
    for line in text_lines:
        draw.text((40, y), line, fill="black", font=font)
        y += 40
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def check(name: str, ok: bool, detail: str = "") -> bool:
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" :: {detail}" if detail else ""))
    return ok


def main() -> int:
    client = TestClient(app)
    failures = 0

    health = client.get("/api/v1/health")
    if not check("health endpoint", health.status_code == 200, health.text):
        failures += 1

    # OCR clear label (CSV linker path, no Postgres required)
    clear = make_label(
        [
            "MISTEL",
            "Telmisartan 80 mg Tablet",
            "FDA Reg. No.: DRP-16103",
            "EXP: 12/31/2028",
        ]
    )
    ocr = client.post(
        "/api/v1/ocr/extract-label",
        files={"file": ("clear.png", clear, "image/png")},
    )
    if ocr.status_code != 200:
        failures += 0 if check("ocr clear label", False, f"status={ocr.status_code}") else 0
        failures += 1
    else:
        payload = ocr.json()
        suggestions = payload.get("suggested_medicines") or []
        ok = bool(suggestions)
        if not check(
            "ocr clear label returns suggestions",
            ok,
            f"count={len(suggestions)} entities={payload.get('entities')}",
        ):
            failures += 1
        else:
            top = suggestions[0]
            check(
                "ocr suggestion has FDA fields",
                all(k in top for k in ("fda_registration_id", "fda_genericname", "confidence_level")),
                f"reg={top.get('fda_registration_id')} conf={top.get('confidence_level')}",
            )

    blank = make_label([])
    blank_img = Image.new("RGB", (400, 200), "white")
    buf = io.BytesIO()
    blank_img.save(buf, format="PNG")
    blank_ocr = client.post(
        "/api/v1/ocr/extract-label",
        files={"file": ("blank.png", buf.getvalue(), "image/png")},
    )
    if blank_ocr.status_code == 200:
        body = blank_ocr.json()
        empty = not body.get("suggested_medicines") and not any(
            (body.get("entities") or {}).get(k) for k in ("medicine_name", "dosage", "expiry_date")
        )
        if not check("ocr blank image yields empty entities/matches", empty, str(body.get("entities"))):
            failures += 1
    else:
        failures += 1
        check("ocr blank image", False, f"status={blank_ocr.status_code}")

    # Auth/profile routes should refuse without DB rather than crash
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "tester@example.com", "password": "SecurePassword123!"},
    )
    if not check(
        "login without postgres returns 5xx/401 not crash",
        login.status_code in {401, 503, 500},
        f"status={login.status_code}",
    ):
        failures += 1

    profiles = client.get("/api/v1/accounts/me/profiles/")
    if not check(
        "profiles without token is unauthorized",
        profiles.status_code in {401, 403},
        f"status={profiles.status_code}",
    ):
        failures += 1

    vault = client.get("/api/v1/vault/demo-profile")
    if not check(
        "vault without token is unauthorized",
        vault.status_code in {401, 403},
        f"status={vault.status_code}",
    ):
        failures += 1

    schedules = client.get("/api/v1/schedules/demo-profile")
    if not check(
        "schedules without token is unauthorized",
        schedules.status_code in {401, 403},
        f"status={schedules.status_code}",
    ):
        failures += 1

    # Fixture goldens still present
    golden = FIXTURES / "01_verified_reg_id.golden.json"
    if not check("fixture golden exists", golden.exists(), str(golden)):
        failures += 1
    else:
        data = json.loads(golden.read_text(encoding="utf-8"))
        if not check(
            "fixture golden has OCRResponse shape",
            "entities" in data and "suggested_medicines" in data,
        ):
            failures += 1

    print("\nSUMMARY failures=", failures)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
