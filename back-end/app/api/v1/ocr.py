# Front-end OCR payload ingestion endpoint
# (Chua, Joseph, Isaac)

import psycopg2
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from crud import crud_medicine
from schemas.ocr import OCRResponse
from services.fda_matcher import find_fda_matches
from services.nlp_service import extract_entities
from services.vision import OCRProcessingError, extract_text


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
    image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the maximum upload size of {MAX_IMAGE_BYTES} bytes.",
        )
    try:
        raw_text = await extract_text(image_bytes)
    except OCRProcessingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    extracted_data = await extract_entities(raw_text)
    print(f"\n--- NLP JSON RESULT ---\n{extracted_data}\n")
    # The dataset matcher tolerates OCR misreads and returns alternatives, so it goes first.
    dataset_suggestions = await find_fda_matches(raw_text)
    suggested_medicines = await _resolve_database_medicines(dataset_suggestions)
    linked_medicine = suggested_medicines[0] if suggested_medicines else None
    if linked_medicine:
        print(
            "\n--- SUGGESTED MEDICINE ---\n"
            f"Name: {linked_medicine.fda_brandname or linked_medicine.fda_genericname}\n"
            f"Dosage: {linked_medicine.fda_dosage_strength or 'Not detected'}\n"
            f"Accuracy: {linked_medicine.confidence_percentage}% "
            f"({linked_medicine.confidence_level.upper()})\n"
            f"Guidance: {linked_medicine.accuracy_guidance}\n"
        )
    else:
        print(
            "\n--- SUGGESTED MEDICINE ---\n"
            "No match found\n"
            "Accuracy: 0% (LOW)\n"
            "Guidance: Use a clear, well-lit photo showing the full brand or generic name and dosage.\n"
        )
    return OCRResponse(
        success=True,
        code=status.HTTP_200_OK,
        message="OCR and medicine extraction completed.",
        entities=extracted_data,
        suggested_medicines=suggested_medicines,
    )
