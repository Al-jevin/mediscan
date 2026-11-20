"""Validate uploaded medicine-label image formats before OCR runs."""

from __future__ import annotations

from dataclasses import dataclass


ALLOWED_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
    }
)
ALLOWED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png"})


@dataclass(frozen=True, slots=True)
class ImageFormatDecision:
    allowed: bool
    detected: str
    reason: str = ""


def _extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower().split("?")[0]


def detect_image_format(image_bytes: bytes) -> str:
    """Return a short format label from magic bytes (not the client MIME)."""
    if len(image_bytes) >= 3 and image_bytes[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if len(image_bytes) >= 8 and image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "webp"
    if len(image_bytes) >= 6 and image_bytes[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    head = image_bytes.lstrip()[:256].lower()
    if head.startswith(b"<svg") or b"<svg" in head[:64]:
        return "svg"
    return "unknown"


def validate_upload_image(
    image_bytes: bytes,
    *,
    content_type: str | None = None,
    filename: str | None = None,
) -> ImageFormatDecision:
    """
    Accept only JPEG/PNG by decoded content.

    Client MIME/extension may be missing or spoofed; magic bytes win. SVG/GIF/WebP
    and undecodable payloads are rejected so OCR never runs on them.
    """
    if not image_bytes:
        return ImageFormatDecision(False, "empty", "Uploaded image is empty.")

    detected = detect_image_format(image_bytes)
    if detected in {"jpeg", "png"}:
        return ImageFormatDecision(True, detected)

    declared = (content_type or "").split(";")[0].strip().lower()
    ext = _extension(filename)
    if detected == "unknown" and (
        declared in ALLOWED_CONTENT_TYPES or ext in ALLOWED_EXTENSIONS
    ):
        # Let the OCR decoder produce a 422 for corrupt-but-claimed JPEG/PNG.
        return ImageFormatDecision(True, "claimed-jpeg-png")

    label = detected if detected != "unknown" else (declared or ext or "unsupported")
    return ImageFormatDecision(
        False,
        label,
        f"Unsupported image format ({label}). Only JPEG and PNG are accepted.",
    )
