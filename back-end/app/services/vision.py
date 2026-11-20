import os
import time
from dataclasses import dataclass
from typing import Literal

os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"

import numpy as np
from starlette.concurrency import run_in_threadpool

from services.image_preprocess import preprocess_medication_image


_OCR_MODEL = None


class OCRProcessingError(RuntimeError):
    """Raised when an image cannot be decoded or processed."""


class OCRConfigurationError(OCRProcessingError):
    """Raised when PaddleOCR or its model configuration is unavailable."""


@dataclass(frozen=True, slots=True)
class OCRLine:
    """One recognized line with its source geometry and confidence."""

    text: str
    confidence: float
    box: tuple[tuple[float, float], ...]
    height: float
    zone: Literal["primary_header", "secondary_body"] | None = None


@dataclass(frozen=True, slots=True)
class OCRResult:
    """Structured OCR output and timing details for one image."""

    text: str
    lines: tuple[OCRLine, ...]
    primary_header_lines: tuple[str, ...]
    secondary_body_lines: tuple[str, ...]
    confidence: float
    preprocess_ms: int
    ocr_ms: int
    roi_fallback_used: bool
    clahe_applied: bool


def _get_ocr_model():
    """Load PaddleOCR only when an image is actually processed."""
    global _OCR_MODEL
    if _OCR_MODEL is None:
        try:
            from paddleocr import PaddleOCR
        except Exception as exc:
            raise OCRConfigurationError(
                "PaddleOCR could not be imported in this environment."
            ) from exc
        try:
            _OCR_MODEL = PaddleOCR(lang="en", enable_mkldnn=False)
        except Exception as exc:
            raise OCRConfigurationError(
                "PaddleOCR could not initialize its English model."
            ) from exc
    return _OCR_MODEL


def _polygon_points(polygon) -> tuple[tuple[float, float], ...]:
    points = np.asarray(polygon, dtype=float)
    if points.ndim == 1 and points.size == 4:
        x1, y1, x2, y2 = points.tolist()
        points = np.asarray(
            ((x1, y1), (x2, y1), (x2, y2), (x1, y2)), dtype=float
        )
    if points.ndim != 2 or points.shape[1] < 2:
        return ()
    return tuple((float(point[0]), float(point[1])) for point in points)


def _line_from_parts(text, confidence, polygon) -> OCRLine | None:
    if not isinstance(text, str) or not text.strip():
        return None
    try:
        score = float(confidence)
    except (TypeError, ValueError):
        score = 0.0
    try:
        box = _polygon_points(polygon) if polygon is not None else ()
    except (TypeError, ValueError):
        box = ()
    height = (
        max(point[1] for point in box) - min(point[1] for point in box)
        if box
        else 0.0
    )
    return OCRLine(
        text=text.strip(),
        confidence=min(1.0, max(0.0, score)),
        box=box,
        height=height,
    )


def _parse_ocr_lines(raw_results) -> tuple[OCRLine, ...]:
    """Normalize the list- and dictionary-based PaddleOCR result formats."""
    if isinstance(raw_results, dict):
        pages = [raw_results]
    elif (
        isinstance(raw_results, (list, tuple))
        and raw_results
        and isinstance(raw_results[0], (list, tuple))
        and len(raw_results[0]) > 1
        and isinstance(raw_results[0][1], (list, tuple))
        and raw_results[0][1]
        and isinstance(raw_results[0][1][0], str)
    ):
        pages = [raw_results]
    else:
        pages = raw_results or []

    lines: list[OCRLine] = []
    for page in pages:
        if isinstance(page, dict):
            texts = page.get("rec_texts", [])
            scores = page.get("rec_scores", [])
            polygons = page.get("dt_polys", page.get("rec_boxes", []))
            for index, text in enumerate(texts):
                confidence = scores[index] if index < len(scores) else 0.0
                polygon = polygons[index] if index < len(polygons) else None
                parsed = _line_from_parts(text, confidence, polygon)
                if parsed:
                    lines.append(parsed)
            continue

        for line in page or []:
            if len(line) < 2:
                continue
            polygon = line[0]
            recognition = line[1]
            if not isinstance(recognition, (list, tuple)) or not recognition:
                continue
            text = recognition[0]
            confidence = recognition[1] if len(recognition) > 1 else 0.0
            parsed = _line_from_parts(text, confidence, polygon)
            if parsed:
                lines.append(parsed)
    return tuple(lines)


def _mean_confidence(lines: tuple[OCRLine, ...]) -> float:
    return sum(line.confidence for line in lines) / len(lines) if lines else 0.0


def _tag_spatial_zones(lines: tuple[OCRLine, ...]) -> tuple[OCRLine, ...]:
    """Tag usable lines by height relative to the most prominent OCR line."""
    usable_heights = [line.height for line in lines if line.confidence >= 0.60]
    max_height = max(usable_heights, default=0.0)
    tagged: list[OCRLine] = []
    for line in lines:
        if line.confidence < 0.60:
            tagged.append(line)
            continue
        ratio = line.height / max_height if max_height > 0 else 0.0
        zone = "primary_header" if ratio >= 0.50 else "secondary_body"
        tagged.append(
            OCRLine(
                text=line.text,
                confidence=line.confidence,
                box=line.box,
                height=line.height,
                zone=zone,
            )
        )
    return tuple(tagged)


def _extract_text_sync(image_bytes: bytes, stage: int = 2) -> OCRResult:
    """Run conditioning and OCR passes synchronously in a worker thread."""
    preprocess_ms = 0
    try:
        conditioned, metadata = preprocess_medication_image(
            image_bytes, stage=stage
        )
        preprocess_ms += int(metadata["preprocess_ms"])
    except Exception as exc:
        raise OCRProcessingError(
            "The uploaded image could not be decoded or preprocessed."
        ) from exc

    try:
        ocr_ms = 0
        ocr_started = time.perf_counter()
        first_pass = _parse_ocr_lines(_get_ocr_model().ocr(conditioned))
        ocr_ms += round((time.perf_counter() - ocr_started) * 1000)
        selected_lines = first_pass
        roi_fallback_used = False
        if stage >= 2 and _mean_confidence(first_pass) < 0.70:
            roi_image, roi_metadata = preprocess_medication_image(
                image_bytes, crop_center_ratio=0.70, stage=stage
            )
            preprocess_ms += int(roi_metadata["preprocess_ms"])
            ocr_started = time.perf_counter()
            roi_pass = _parse_ocr_lines(_get_ocr_model().ocr(roi_image))
            ocr_ms += round((time.perf_counter() - ocr_started) * 1000)
            roi_fallback_used = True
            if _mean_confidence(roi_pass) > _mean_confidence(first_pass):
                selected_lines = roi_pass
    except OCRConfigurationError:
        raise
    except Exception as exc:
        raise OCRProcessingError(
            "PaddleOCR could not extract text from the uploaded image."
        ) from exc

    selected_lines = _tag_spatial_zones(selected_lines)
    readable_text = "\n".join(line.text for line in selected_lines)
    primary = tuple(
        line.text for line in selected_lines if line.zone == "primary_header"
    )
    secondary = tuple(
        line.text for line in selected_lines if line.zone == "secondary_body"
    )
    print(f"\n--- RAW OCR OUTPUT ---\n{readable_text or 'No text detected'}\n", flush=True)
    return OCRResult(
        text=readable_text,
        lines=selected_lines,
        primary_header_lines=primary,
        secondary_body_lines=secondary,
        confidence=_mean_confidence(selected_lines),
        preprocess_ms=preprocess_ms,
        ocr_ms=ocr_ms,
        roi_fallback_used=roi_fallback_used,
        clahe_applied=bool(metadata.get("clahe_applied")),
    )


async def extract_ocr_result(image_bytes: bytes, stage: int = 2) -> OCRResult:
    """Return structured OCR output without blocking the FastAPI event loop."""
    if not image_bytes:
        raise OCRProcessingError("The uploaded image is empty.")
    return await run_in_threadpool(_extract_text_sync, image_bytes, stage)


async def extract_text(image_bytes: bytes) -> str:
    """Extract OCR text while preserving the original string return contract."""
    return (await extract_ocr_result(image_bytes)).text
