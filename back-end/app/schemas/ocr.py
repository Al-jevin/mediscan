"""Pydantic contracts for OCR, NER, and medicine-linking responses."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ImageUploadRequest(BaseModel):
    """Base64 image payload for clients that do not use multipart uploads."""

    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(
        min_length=1,
        description="Base64-encoded medicine-label image without a data URI prefix.",
    )
    filename: str | None = Field(default=None, max_length=255)
    content_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


class ExtractedEntityResponse(BaseModel):
    """Entities identified in the OCR text by the NER service."""

    model_config = ConfigDict(extra="forbid")

    medicine_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    expiry_date: Optional[str] = None


class LinkedMedicineResponse(BaseModel):
    """A suggested match from the FDA medicine registry."""

    model_config = ConfigDict(extra="forbid")

    fda_id: int = Field(ge=1)
    fda_registration_id: str = Field(min_length=1)
    fda_approval_id: str = Field(min_length=1)
    fda_brandname: str | None = None
    fda_genericname: str = Field(min_length=1)
    fda_dosage_form: str | None = None
    fda_dosage_strength: str | None = None
    fda_manufacturer: str | None = None
    fda_pharmacologic_category: str | None = None
    fda_classification: str | None = None
    match_type: Literal["exact", "fuzzy"] = "exact"
    match_score: float = Field(ge=0, le=1)
    confidence_percentage: int = Field(default=0, ge=0, le=100)
    confidence_level: Literal["max", "high", "medium", "low"] = "low"
    trust_score: float | None = Field(default=None, ge=0, le=1)
    trust_tier: Literal["high", "medium", "low"] | None = None
    accuracy_guidance: str = Field(
        default="Use a clear, well-lit photo showing the full brand or generic name and dosage.",
        min_length=1,
        max_length=500,
    )


class OCRLatencyMetrics(BaseModel):
    preprocess_ms: int = Field(default=0, ge=0)
    ocr_ms: int = Field(default=0, ge=0)
    nlp_ms: int = Field(default=0, ge=0)
    db_match_ms: int = Field(default=0, ge=0)
    total_ms: int = Field(default=0, ge=0)


class ScanTelemetry(BaseModel):
    """Auditable OCR, confidence, and latency details for one scan."""

    stage: Literal[0, 1, 2] = 2
    raw_ocr_text: str = ""
    grounded_text: str = ""
    applied_preprocessing: list[str] = Field(default_factory=list)
    quarantined_distractors: list[str] = Field(default_factory=list)
    primary_header_lines: list[str] = Field(default_factory=list)
    secondary_body_lines: list[str] = Field(default_factory=list)
    clahe_applied: bool = False
    roi_fallback_used: bool = False
    ocr_confidence: float = Field(default=0, ge=0, le=1)
    dosage_confidence: float = Field(default=0, ge=0, le=1)
    fda_match_score: float = Field(default=0, ge=0, le=1)
    trust_score: float = Field(default=0, ge=0, le=1)
    trust_tier: Literal["high", "medium", "low"] = "low"
    confidence_tier: Literal["high", "medium", "low"] = "low"
    dosage_match_status: Literal[
        "matched", "mismatch", "not_detected", "unverified", "no_match"
    ] = "no_match"
    safety_cap_reason: str | None = None
    latency_ms: OCRLatencyMetrics = Field(default_factory=OCRLatencyMetrics)
    preprocess_ms: int = Field(default=0, ge=0)
    ocr_ms: int = Field(default=0, ge=0)
    grounding_ms: int = Field(default=0, ge=0)
    nlp_ms: int = Field(default=0, ge=0)
    db_match_ms: int = Field(default=0, ge=0)
    total_ms: int = Field(default=0, ge=0)
    total_latency_ms: int = Field(default=0, ge=0)


class OCRResponse(BaseModel):
    """Final OCR/NER response returned to an API or mobile client."""

    model_config = ConfigDict(extra="forbid")

    success: bool
    code: int = Field(ge=100, le=599)
    message: str = Field(min_length=1, max_length=500)
    entities: ExtractedEntityResponse
    suggested_medicines: list[LinkedMedicineResponse] = Field(default_factory=list)
    trust_score: float = Field(default=0, ge=0, le=1)
    confidence_tier: Literal["high", "medium", "low"] = "low"
    dosage_match_status: Literal[
        "matched", "mismatch", "not_detected", "unverified", "no_match"
    ] = "no_match"
    safety_cap_reason: str | None = None
    telemetry: ScanTelemetry = Field(default_factory=ScanTelemetry)
