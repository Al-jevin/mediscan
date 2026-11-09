"""Generate synthetic medicine label images and capture live /api/v1/ocr/extract-label golden JSON outputs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

BACKEND_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from main import app

FIXTURES_DIR = BACKEND_ROOT / "tests" / "fixtures" / "labels"

FIXTURE_SPECS = [
    {
        "slug": "01_verified_reg_id",
        "size": (800, 320),
        "bg": "white",
        "fg": "black",
        "font_size": 32,
        "lines": [
            "MISTEL",
            "Telmisartan 80 mg Tablet",
            "FDA Reg. No.: DRP-16103",
            "EXP: 12/31/2028",
        ],
    },
    {
        "slug": "02_needs_verification_multi",
        "size": (800, 260),
        "bg": "white",
        "fg": "black",
        "font_size": 32,
        "lines": [
            "HEPARIN LEO",
            "Heparin Sodium",
            "Solution For Injection",
        ],
    },
    {
        "slug": "03_low_contrast_no_match",
        "size": (600, 200),
        "bg": "#F5F5F5",
        "fg": "#D0D0D0",
        "font_size": 14,
        "lines": [
            "UNKNOWNXYZ SUPPLEMENT 999 mg",
        ],
    },
    {
        "slug": "04_blank_unreadable",
        "size": (600, 200),
        "bg": "white",
        "fg": "white",
        "font_size": 16,
        "lines": [],
    },
]


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in ("arial.ttf", "calibri.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(candidate, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def generate_and_capture() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    client = TestClient(app)
    summary: list[dict] = []

    for spec in FIXTURE_SPECS:
        img = Image.new("RGB", spec["size"], spec["bg"])
        draw = ImageDraw.Draw(img)
        font = _load_font(spec["font_size"])
        y = 32
        for line in spec["lines"]:
            draw.text((36, y), line, fill=spec["fg"], font=font)
            y += spec["font_size"] + 18

        img_path = FIXTURES_DIR / f"{spec['slug']}.png"
        img.save(img_path, format="PNG")

        with img_path.open("rb") as fh:
            resp = client.post(
                "/api/v1/ocr/extract-label",
                files={"file": (img_path.name, fh.read(), "image/png")},
            )

        payload = resp.json()
        golden_path = FIXTURES_DIR / f"{spec['slug']}.golden.json"
        golden_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        summary.append(
            {
                "slug": spec["slug"],
                "status_code": resp.status_code,
                "entities": payload.get("entities"),
                "suggested_count": len(payload.get("suggested_medicines", [])),
                "top_match": (
                    payload["suggested_medicines"][0]["fda_brandname"]
                    if payload.get("suggested_medicines")
                    else None
                ),
                "top_confidence": (
                    payload["suggested_medicines"][0]["confidence_level"]
                    if payload.get("suggested_medicines")
                    else None
                ),
            }
        )

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    generate_and_capture()
