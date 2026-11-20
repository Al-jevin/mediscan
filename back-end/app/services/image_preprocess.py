"""Image conditioning helpers for medication-label OCR."""

from __future__ import annotations

import time

import cv2
import numpy as np


MAX_EDGE = 1280
MIN_EDGE = 640
UPSCALE_EDGE = 1000


def preprocess_medication_image(
    image_bytes: bytes,
    crop_center_ratio: float | None = None,
    *,
    stage: int = 2,
) -> tuple[np.ndarray, dict[str, int | bool]]:
    """Decode and condition an image, optionally selecting a centered ROI.

    Stages:
    - 0: decode + resize only
    - 1: decode + resize + CLAHE/bilateral (no ROI crop)
    - 2: full pipeline including optional ROI crop
    """
    started = time.perf_counter()
    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    try:
        image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    except cv2.error as exc:
        raise ValueError("The uploaded image could not be decoded.") from exc
    if image is None:
        raise ValueError("The uploaded image could not be decoded.")

    original_height, original_width = image.shape[:2]
    roi_cropped = crop_center_ratio is not None and stage >= 2
    if roi_cropped:
        if not 0 < crop_center_ratio <= 1:
            raise ValueError("crop_center_ratio must be greater than 0 and at most 1.")
        crop_height = max(1, round(original_height * crop_center_ratio))
        crop_width = max(1, round(original_width * crop_center_ratio))
        top = (original_height - crop_height) // 2
        left = (original_width - crop_width) // 2
        image = image[top : top + crop_height, left : left + crop_width]

    height, width = image.shape[:2]
    edge = max(height, width)
    resized = False
    if edge > MAX_EDGE:
        scale = MAX_EDGE / edge
        image = cv2.resize(
            image,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA,
        )
        resized = True
    elif edge < MIN_EDGE:
        scale = UPSCALE_EDGE / edge
        image = cv2.resize(
            image,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_CUBIC,
        )
        resized = True

    clahe_applied = False
    bilateral_filter_applied = False
    conditioned = image
    if stage >= 1:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        lightness, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = cv2.merge((clahe.apply(lightness), a_channel, b_channel))
        conditioned = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        conditioned = cv2.bilateralFilter(
            conditioned, d=5, sigmaColor=50, sigmaSpace=50
        )
        clahe_applied = True
        bilateral_filter_applied = True
    return conditioned, {
        "clahe_applied": clahe_applied,
        "bilateral_filter_applied": bilateral_filter_applied,
        "resized": resized,
        "roi_cropped": roi_cropped,
        "preprocess_ms": round((time.perf_counter() - started) * 1000),
    }
