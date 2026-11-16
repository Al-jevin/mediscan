import asyncio
import io
import sys
from pathlib import Path

import pytest
from PIL import Image

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from services import vision
from services.image_preprocess import preprocess_medication_image


def _image_bytes(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def _line(text: str, confidence: float, height: int):
    return [
        [[0, 0], [100, 0], [100, height], [0, height]],
        [text, confidence],
    ]


class _FakeOCR:
    def __init__(self, outputs):
        self.outputs = iter(outputs)
        self.images = []

    def ocr(self, image):
        self.images.append(image)
        return next(self.outputs)


def test_preprocessing_caps_large_images_and_upscales_small_images():
    large, large_meta = preprocess_medication_image(_image_bytes(2400, 1200))
    small, small_meta = preprocess_medication_image(_image_bytes(320, 240))

    assert max(large.shape[:2]) == 1280
    assert max(small.shape[:2]) == 1000
    assert large_meta["resized"] is True
    assert small_meta["resized"] is True
    assert large_meta["clahe_applied"] is True
    assert large_meta["bilateral_filter_applied"] is True
    assert large_meta["preprocess_ms"] >= 0


def test_preprocessing_crops_center_roi_before_scaling():
    image, metadata = preprocess_medication_image(
        _image_bytes(2000, 1000), crop_center_ratio=0.70
    )

    assert image.shape[:2] == (640, 1280)
    assert metadata["roi_cropped"] is True


def test_preprocessing_rejects_invalid_bytes_and_roi_ratio():
    with pytest.raises(ValueError, match="could not be decoded"):
        preprocess_medication_image(b"not an image")
    with pytest.raises(ValueError, match="crop_center_ratio"):
        preprocess_medication_image(_image_bytes(800, 600), crop_center_ratio=0)


def test_structured_ocr_keeps_geometry_and_tags_spatial_lines(monkeypatch):
    fake_model = _FakeOCR([[_line("Header", 0.96, 40), _line("Generic", 0.91, 19)]])
    monkeypatch.setattr(vision, "_OCR_MODEL", fake_model)

    result = vision._extract_text_sync(_image_bytes(800, 600))

    assert result.text == "Header\nGeneric"
    assert result.lines[0].box[0] == (0.0, 0.0)
    assert result.lines[0].zone == "primary_header"
    assert result.lines[1].zone == "secondary_body"
    assert result.primary_header_lines == ("Header",)
    assert result.secondary_body_lines == ("Generic",)
    assert result.confidence == pytest.approx(0.935)
    assert result.preprocess_ms >= 0
    assert result.ocr_ms >= 0
    assert result.roi_fallback_used is False


def test_low_confidence_ocr_retries_original_center_roi(monkeypatch):
    fake_model = _FakeOCR(
        [
            [_line("Unclear", 0.61, 30)],
            [_line("Paracetamol", 0.93, 30)],
        ]
    )
    monkeypatch.setattr(vision, "_OCR_MODEL", fake_model)

    result = vision._extract_text_sync(_image_bytes(1600, 1000))

    assert len(fake_model.images) == 2
    assert result.text == "Paracetamol"
    assert result.confidence == pytest.approx(0.93)
    assert result.roi_fallback_used is True


def test_lower_confidence_roi_does_not_replace_first_pass(monkeypatch):
    fake_model = _FakeOCR(
        [
            [_line("First pass", 0.65, 30)],
            [_line("ROI pass", 0.50, 30)],
        ]
    )
    monkeypatch.setattr(vision, "_OCR_MODEL", fake_model)

    result = vision._extract_text_sync(_image_bytes(800, 600))

    assert result.text == "First pass"
    assert result.roi_fallback_used is True
    assert len(fake_model.images) == 2


def test_parser_supports_dictionary_results():
    result = vision._parse_ocr_lines(
        [
            {
                "rec_texts": ["Paracetamol"],
                "rec_scores": [0.97],
                "dt_polys": [[[0, 0], [100, 0], [100, 25], [0, 25]]],
            }
        ]
    )

    assert len(result) == 1
    assert result[0].text == "Paracetamol"
    assert result[0].confidence == pytest.approx(0.97)
    assert result[0].height == pytest.approx(25)


def test_extract_text_remains_string_returning_compatibility_api(monkeypatch):
    fake_model = _FakeOCR([[_line("Biogesic 500 mg", 0.98, 30)]])
    monkeypatch.setattr(vision, "_OCR_MODEL", fake_model)

    result = asyncio.run(vision.extract_text(_image_bytes(800, 600)))

    assert result == "Biogesic 500 mg"
    assert isinstance(result, str)
