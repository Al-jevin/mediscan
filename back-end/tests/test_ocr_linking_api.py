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


def test_extract_label_returns_database_medicine_identifier(monkeypatch):
    async def fake_extract_text(_image_bytes):
        return "BIOGESIC PARACETAMOL 500 mg"

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

    monkeypatch.setattr(ocr, "extract_text", fake_extract_text)
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


def test_extract_label_rejects_oversized_upload(monkeypatch):
    monkeypatch.setattr(ocr, "MAX_IMAGE_BYTES", 4)
    response = TestClient(app).post(
        "/api/v1/ocr/extract-label",
        files={"file": ("label.png", b"12345", "image/png")},
    )

    assert response.status_code == 413
    assert "maximum upload size" in response.json()["detail"]
