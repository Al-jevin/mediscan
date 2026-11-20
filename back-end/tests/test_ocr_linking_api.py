import io
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from api.v1 import ocr
from main import app
from schemas.ocr import ExtractedEntityResponse, LinkedMedicineResponse
from services.vision import OCRLine, OCRResult


def test_extract_label_returns_database_medicine_identifier(monkeypatch, capsys):
    async def fake_extract_ocr_result(_image_bytes, stage=2):
        lines = (
            OCRLine("BIOGESIC PARACETAMOL", 0.95, (), 0, "primary_header"),
            OCRLine("500 mg Tablet", 0.9, (), 0, "secondary_body"),
            OCRLine("100 Tablets", 0.99, (), 0, "secondary_body"),
        )
        return OCRResult(
            text="BIOGESIC PARACETAMOL\n500 mg Tablet\n100 Tablets",
            lines=lines,
            primary_header_lines=("BIOGESIC PARACETAMOL",),
            secondary_body_lines=("500 mg Tablet", "100 Tablets"),
            confidence=0.95,
            preprocess_ms=4,
            ocr_ms=12,
            roi_fallback_used=False,
            clahe_applied=True,
        )

    async def fake_extract_entities(_raw_text):
        return ExtractedEntityResponse(
            medicine_name="BIOGESIC PARACETAMOL",
            dosage="500 mg",
        )

    suggestion = LinkedMedicineResponse(
        fda_id=1,
        fda_registration_id="REG-1",
        fda_approval_id="APP-1",
        fda_brandname="CSV brand",
        fda_genericname="CSV generic",
        fda_dosage_form="Tablet",
        fda_dosage_strength="500 mg",
        match_type="exact",
        match_score=1.0,
        confidence_percentage=100,
    )
    database_row = {
        "fda_id": 9284,
        "fda_registration_id": "REG-1",
        "fda_approval_id": "APP-1",
        "fda_brandname": "Biogesic",
        "fda_genericname": "Paracetamol",
        "fda_dosage_form": "Tablet",
        "fda_dosage_strength": "500 mg",
        "fda_manufacturer": "Unilab",
        "fda_pharmacologic_category": "Analgesic",
        "fda_classification": "Over-the-Counter (OTC)",
    }

    monkeypatch.setattr(ocr, "extract_ocr_result", fake_extract_ocr_result)
    monkeypatch.setattr(ocr, "extract_entities", fake_extract_entities)
    async def fake_matches(_text):
        return [suggestion]

    monkeypatch.setattr(ocr, "find_fda_matches", fake_matches)
    monkeypatch.setattr(
        ocr.crud_medicine, "get_fda_medicine_by_registration_id", lambda _reg: database_row
    )
    image_bytes = io.BytesIO()
    Image.new("RGB", (10, 10), "white").save(image_bytes, format="PNG")
    response = TestClient(app).post(
        "/api/v1/ocr/extract-label",
        files={"file": ("label.png", image_bytes.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "raw_text" not in payload
    assert payload["entities"]["medicine_name"] == "BIOGESIC PARACETAMOL"
    assert payload["suggested_medicines"][0]["fda_id"] == 9284
    assert payload["suggested_medicines"][0]["fda_brandname"] == "Biogesic"
    assert payload["trust_score"] == 0.98
    assert payload["telemetry"]["fda_match_score"] == 1.0
    assert payload["confidence_tier"] == "high"
    assert payload["dosage_match_status"] == "matched"
    assert payload["safety_cap_reason"] is None
    assert payload["telemetry"]["stage"] == 2
    assert payload["telemetry"]["raw_ocr_text"] == (
        "BIOGESIC PARACETAMOL\n500 mg Tablet\n100 Tablets"
    )
    assert payload["telemetry"]["applied_preprocessing"] == ["CLAHE"]
    assert payload["telemetry"]["primary_header_lines"] == ["BIOGESIC PARACETAMOL"]
    assert payload["telemetry"]["secondary_body_lines"] == ["500 mg Tablet", "100 Tablets"]
    assert payload["telemetry"]["quarantined_distractors"] == ["100 Tablets"]
    assert payload["telemetry"]["latency_ms"]["preprocess_ms"] == 4
    assert payload["telemetry"]["latency_ms"]["ocr_ms"] == 12
    assert payload["telemetry"]["latency_ms"]["total_ms"] > 0
    terminal_output = capsys.readouterr().out
    assert "--- SCAN TELEMETRY ---" in terminal_output
    assert "OCR confidence: 95%" in terminal_output
    assert "Trust: 98% (HIGH)" in terminal_output
    assert "Dosage match: matched" in terminal_output


def test_extract_label_caps_trust_on_dosage_conflict(monkeypatch):
    async def fake_extract_ocr_result(_image_bytes, stage=2):
        return OCRResult(
            text="BIOGESIC PARACETAMOL\n250 mg Tablet",
            lines=(OCRLine("250 mg Tablet", 0.96, (), 0, "secondary_body"),),
            primary_header_lines=("BIOGESIC PARACETAMOL",),
            secondary_body_lines=("250 mg Tablet",),
            confidence=0.96,
            preprocess_ms=0,
            ocr_ms=0,
            roi_fallback_used=False,
            clahe_applied=True,
        )

    async def fake_extract_entities(_raw_text):
        return ExtractedEntityResponse(
            medicine_name="BIOGESIC PARACETAMOL",
            dosage="250 mg",
        )

    suggestion = LinkedMedicineResponse(
        fda_id=1,
        fda_registration_id="REG-1",
        fda_approval_id="APP-1",
        fda_brandname="Biogesic",
        fda_genericname="Paracetamol",
        fda_dosage_form="Tablet",
        fda_dosage_strength="500 mg",
        match_type="fuzzy",
        match_score=0.98,
        confidence_percentage=98,
    )
    database_row = {
        "fda_id": 9284,
        "fda_registration_id": "REG-1",
        "fda_approval_id": "APP-1",
        "fda_brandname": "Biogesic",
        "fda_genericname": "Paracetamol",
        "fda_dosage_form": "Tablet",
        "fda_dosage_strength": "500 mg",
        "fda_manufacturer": "Unilab",
        "fda_pharmacologic_category": "Analgesic",
        "fda_classification": "Over-the-Counter (OTC)",
    }

    monkeypatch.setattr(ocr, "extract_ocr_result", fake_extract_ocr_result)
    monkeypatch.setattr(ocr, "extract_entities", fake_extract_entities)

    async def fake_matches(_text):
        return [suggestion]

    monkeypatch.setattr(ocr, "find_fda_matches", fake_matches)
    monkeypatch.setattr(
        ocr.crud_medicine, "get_fda_medicine_by_registration_id", lambda _reg: database_row
    )
    image_bytes = io.BytesIO()
    Image.new("RGB", (10, 10), "white").save(image_bytes, format="PNG")
    response = TestClient(app).post(
        "/api/v1/ocr/extract-label",
        files={"file": ("label.png", image_bytes.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["dosage_match_status"] == "mismatch"
    assert payload["safety_cap_reason"]
    assert payload["trust_score"] <= 0.64
    assert payload["suggested_medicines"][0]["trust_score"] <= 0.64


def test_extract_label_rejects_oversized_upload(monkeypatch):
    monkeypatch.setattr(ocr, "MAX_IMAGE_BYTES", 4)
    response = TestClient(app).post(
        "/api/v1/ocr/extract-label",
        files={"file": ("label.png", b"12345", "image/png")},
    )

    assert response.status_code == 413
    assert "maximum upload size" in response.json()["detail"]


def test_extract_label_rejects_gif_before_ocr(monkeypatch):
    called = {"ocr": False}

    async def fake_extract_ocr_result(_image_bytes, stage=2):
        called["ocr"] = True
        raise AssertionError("OCR must not run for unsupported formats")

    monkeypatch.setattr(ocr, "extract_ocr_result", fake_extract_ocr_result)
    response = TestClient(app).post(
        "/api/v1/ocr/extract-label",
        files={"file": ("label.gif", b"GIF89a" + b"\x00" * 20, "image/gif")},
    )

    assert response.status_code == 415
    assert "JPEG and PNG" in response.json()["detail"]
    assert called["ocr"] is False


def test_extract_label_rejects_svg_even_with_spoofed_png_mime(monkeypatch):
    called = {"ocr": False}

    async def fake_extract_ocr_result(_image_bytes, stage=2):
        called["ocr"] = True
        raise AssertionError("OCR must not run for SVG uploads")

    monkeypatch.setattr(ocr, "extract_ocr_result", fake_extract_ocr_result)
    response = TestClient(app).post(
        "/api/v1/ocr/extract-label",
        files={
            "file": (
                "label.png",
                b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
                "image/png",
            )
        },
    )

    assert response.status_code == 415
    assert called["ocr"] is False
