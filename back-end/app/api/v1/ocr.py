# Front-end OCR payload ingestion endpoint
# (Chua, Joseph, Isaac)

from time import perf_counter

import psycopg2
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from crud import crud_medicine
from schemas.ocr import OCRLatencyMetrics, OCRResponse, ScanTelemetry
from services.fda_matcher import (
    canonicalize_dosage,
    dedupe_medicine_suggestions,
    find_dosages,
    find_fda_matches,
    score_suggestions_for_safety,
)
from services.image_format import validate_upload_image
from services.nlp_service import extract_entities, strip_packaging_distractors
from services.vision import OCRProcessingError, extract_ocr_result


router = APIRouter()
MAX_IMAGE_BYTES = 10 * 1024 * 1024


async def _resolve_database_medicines(suggestions):
    """Replace dataset positions with records and IDs from the live FDA registry."""
    resolved = []
    try:
        for suggestion in suggestions:
            row = await run_in_threadpool(
                crud_medicine.get_fda_medicine_by_registration_id,
                suggestion.fda_registration_id,
            )
            if row is None:
                continue
            resolved.append(
                suggestion.model_copy(
                    update={
                        "fda_id": row["fda_id"],
                        "fda_registration_id": row["fda_registration_id"],
                        "fda_approval_id": row["fda_approval_id"],
                        "fda_brandname": row["fda_brandname"],
                        "fda_genericname": row["fda_genericname"],
                        "fda_dosage_form": row["fda_dosage_form"],
                        "fda_dosage_strength": row["fda_dosage_strength"],
                        "fda_manufacturer": row["fda_manufacturer"],
                        "fda_pharmacologic_category": row[
                            "fda_pharmacologic_category"
                        ],
                        "fda_classification": row["fda_classification"],
                    }
                )
            )
    except (RuntimeError, psycopg2.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FDA medicine database is unavailable.",
        ) from error
    return resolved


@router.post(
    "/extract-label",
    response_model=OCRResponse,
    status_code=status.HTTP_200_OK,
)
async def extract_label(
    file: UploadFile = File(
        ...,
        description="Medicine-label image for OCR and medicine matching.",
    ),
):
    """Extract NER entities from an uploaded medicine-label image."""
    request_started = perf_counter()
    image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the maximum upload size of {MAX_IMAGE_BYTES} bytes.",
        )
    format_decision = validate_upload_image(
        image_bytes,
        content_type=file.content_type,
        filename=file.filename,
    )
    if not format_decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=format_decision.reason,
        )
    try:
        ocr_result = await extract_ocr_result(image_bytes)
    except OCRProcessingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    raw_text = ocr_result.text

    nlp_started = perf_counter()
    extracted_data = await extract_entities(raw_text)
    nlp_ms = round((perf_counter() - nlp_started) * 1000)
    print(f"\n--- NLP JSON RESULT ---\n{extracted_data}\n", flush=True)

    db_match_started = perf_counter()
    # The dataset matcher tolerates OCR misreads and returns alternatives, so it goes first.
    dataset_suggestions = await find_fda_matches(raw_text)
    suggested_medicines = dedupe_medicine_suggestions(
        await _resolve_database_medicines(dataset_suggestions)
    )
    db_match_ms = round((perf_counter() - db_match_started) * 1000)

    dosage_line_confidences = [
        line.confidence for line in ocr_result.lines if find_dosages(line.text)
    ]
    dosage_confidence = max(dosage_line_confidences, default=0.0)
    (
        suggested_medicines,
        _best_trust_score,
        dosage_confidence,
        _best_confidence_tier,
    ) = score_suggestions_for_safety(
        suggested_medicines,
        raw_text,
        ocr_result.confidence,
        dosage_confidence,
    )
    linked_medicine = suggested_medicines[0] if suggested_medicines else None
    trust_score = (linked_medicine.trust_score or 0.0) if linked_medicine else 0.0
    confidence_tier = (
        linked_medicine.trust_tier
        if linked_medicine and linked_medicine.trust_tier
        else "low"
    )
    detected_dosages = {
        canonicalize_dosage(dosage) for dosage in find_dosages(raw_text)
    }
    catalog_dosage = canonicalize_dosage(
        linked_medicine.fda_dosage_strength if linked_medicine else None
    )
    if linked_medicine is None:
        dosage_match_status = "no_match"
    elif not detected_dosages:
        dosage_match_status = "not_detected"
    elif not catalog_dosage:
        dosage_match_status = "unverified"
    elif catalog_dosage in detected_dosages:
        dosage_match_status = "matched"
    else:
        dosage_match_status = "mismatch"

    safety_cap_reason = None
    if dosage_match_status == "mismatch":
        safety_cap_reason = (
            "Detected label dosage conflicts with the FDA strength; trust is capped at 0.64."
        )
    elif dosage_match_status == "not_detected":
        safety_cap_reason = (
            "No dosage was detected; trust is capped at 0.79 pending verification."
        )
    elif dosage_match_status == "unverified":
        safety_cap_reason = (
            "The linked FDA record has no comparable strength; trust is capped at 0.79."
        )
    elif linked_medicine is not None and dosage_confidence < 0.85:
        safety_cap_reason = (
            "Dosage OCR confidence is below 0.85; trust is capped at 0.79."
        )

    preprocessing = []
    if ocr_result.clahe_applied:
        preprocessing.append("CLAHE")
    if ocr_result.roi_fallback_used:
        preprocessing.append("ROI fallback")
    quarantined_distractors = [
        line
        for line in raw_text.splitlines()
        if line.strip() and strip_packaging_distractors(line).strip() != line.strip()
    ]
    grounded_text = "\n".join(
        value
        for value in (extracted_data.medicine_name, extracted_data.dosage)
        if value
    )
    total_ms = round((perf_counter() - request_started) * 1000)
    telemetry = ScanTelemetry(
        stage=2,
        raw_ocr_text=raw_text,
        grounded_text=grounded_text,
        applied_preprocessing=preprocessing,
        quarantined_distractors=quarantined_distractors,
        primary_header_lines=list(ocr_result.primary_header_lines),
        secondary_body_lines=list(ocr_result.secondary_body_lines),
        clahe_applied=ocr_result.clahe_applied,
        roi_fallback_used=ocr_result.roi_fallback_used,
        ocr_confidence=ocr_result.confidence,
        dosage_confidence=dosage_confidence,
        fda_match_score=linked_medicine.match_score if linked_medicine else 0,
        trust_score=trust_score,
        trust_tier=confidence_tier,
        confidence_tier=confidence_tier,
        dosage_match_status=dosage_match_status,
        safety_cap_reason=safety_cap_reason,
        latency_ms=OCRLatencyMetrics(
            preprocess_ms=ocr_result.preprocess_ms,
            ocr_ms=ocr_result.ocr_ms,
            nlp_ms=nlp_ms,
            db_match_ms=db_match_ms,
            total_ms=total_ms,
        ),
        preprocess_ms=ocr_result.preprocess_ms,
        ocr_ms=ocr_result.ocr_ms,
        grounding_ms=nlp_ms,
        nlp_ms=nlp_ms,
        db_match_ms=db_match_ms,
        total_ms=total_ms,
        total_latency_ms=total_ms,
    )
    match_summary = (
        f"{linked_medicine.confidence_percentage}% "
        f"(score {linked_medicine.match_score:.3f})"
        if linked_medicine
        else "No match"
    )
    print(
        "\n--- SCAN TELEMETRY ---\n"
        f"Stage: {telemetry.stage}\n"
        f"OCR confidence: {ocr_result.confidence:.0%}\n"
        f"Dosage OCR confidence: {dosage_confidence:.0%}\n"
        f"FDA match: {match_summary}\n"
        f"Trust: {trust_score:.0%} ({confidence_tier.upper()})\n"
        f"Dosage match: {dosage_match_status}\n"
        f"Safety cap: {safety_cap_reason or 'None'}\n"
        f"Preprocessing: {', '.join(preprocessing) or 'None'}\n"
        "Latency (ms): "
        f"preprocess={ocr_result.preprocess_ms}, "
        f"ocr={ocr_result.ocr_ms}, nlp={nlp_ms}, "
        f"db_match={db_match_ms}, total={total_ms}\n",
        flush=True,
    )
    if linked_medicine:
        print(
            "\n--- SUGGESTED MEDICINE ---\n"
            f"Name: {linked_medicine.fda_brandname or linked_medicine.fda_genericname}\n"
            f"Dosage: {linked_medicine.fda_dosage_strength or 'Not detected'}\n"
            f"Accuracy: {linked_medicine.confidence_percentage}% "
            f"({linked_medicine.confidence_level.upper()})\n"
            f"Trust: {trust_score:.2f} ({confidence_tier.upper()})\n"
            f"Guidance: {linked_medicine.accuracy_guidance}\n",
            flush=True,
        )
    else:
        print(
            "\n--- SUGGESTED MEDICINE ---\n"
            "No match found\n"
            "Accuracy: 0% (LOW)\n"
            "Guidance: Use a clear, well-lit photo showing the full brand or generic name and dosage.\n",
            flush=True,
        )
    return OCRResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="OCR and medicine extraction completed.",
        entities=extracted_data,
        suggested_medicines=suggested_medicines,
        trust_score=trust_score,
        confidence_tier=confidence_tier,
        dosage_match_status=dosage_match_status,
        safety_cap_reason=safety_cap_reason,
        telemetry=telemetry,
    )
