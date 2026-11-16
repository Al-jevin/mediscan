# OCR Preprocessing Pilot

This guide covers the recent backend image-preprocessing and OCR-vision changes:

- Image resize limits, LAB CLAHE, bilateral filtering, and native-resolution center crops
- Structured OCR output with bounding boxes, confidence, and primary/secondary line zones
- A center-ROI retry when mean OCR confidence is below `0.70`
- The existing `extract_text(image_bytes)` string-returning API

The pilot does not require the Expo app. The automated API regression test uses mocks; the optional real-image probe runs PaddleOCR and may require its model files and a working local PostgreSQL setup only if you test through the HTTP endpoint.

## 1. Open PowerShell at the repository root

Confirm that the terminal is in the `mediscan` project directory:

```powershell
Get-Location
```

The commands below use the repository's `back-end\.venv`. If it does not exist, create it and install backend requirements:

```powershell
py -3.11 -m venv back-end\.venv
.\back-end\.venv\Scripts\python.exe -m pip install -r back-end\requirements.txt
```

Set a short variable for the Python executable:

```powershell
$Python = ".\back-end\.venv\Scripts\python.exe"
& $Python --version
```

`opencv-python-headless` and `rapidfuzz` are already declared in `back-end\requirements.txt`.

## 2. Run focused automated tests

Run the new preprocessing/vision tests plus the related FDA matcher and OCR API regression tests:

```powershell
& $Python -m pytest back-end\tests\test_vision_preprocessing.py back-end\tests\test_fda_matcher.py back-end\tests\test_ocr_linking_api.py -q
```

Expected result: **21 passed**. The vision tests use a fake OCR model, so they do not download model files or make real OCR predictions.

The tests cover:

- Downscaling large images to a 1280 px maximum edge and upscaling small images to 1000 px
- Applying image conditioning and cropping the center ROI before resizing
- Retaining OCR geometry and confidence, and tagging spatial prominence zones
- Retrying when first-pass confidence is below `0.70` and selecting the higher-confidence result
- Preserving the `extract_text(...) -> str` interface
- Existing OCR API and FDA matching behavior

## 3. Run all backend tests (optional)

```powershell
& $Python -m pytest back-end\tests\ -q
```

Some CRUD/API tests may need the local PostgreSQL database configured and running. If those tests fail on database setup, use the focused command in Step 2 to validate the OCR changes independently.

## 4. Probe a real image through the structured OCR service (optional)

Choose a medicine-label photo stored locally. This calls the OCR service directly, so it does not require the API or database. PaddleOCR must be installed and able to initialize its English model.

Set the image path and make the backend app importable:

```powershell
$env:OCR_TEST_IMAGE = "C:\path\to\medicine-label.jpg"
$env:PYTHONPATH = (Resolve-Path .\back-end\app).Path
```

Run the structured extraction probe:

```powershell
@'
import asyncio
import os
from pathlib import Path

from services.vision import extract_ocr_result

result = asyncio.run(extract_ocr_result(Path(os.environ["OCR_TEST_IMAGE"]).read_bytes()))
print("Text:", result.text)
print("Mean OCR confidence:", round(result.confidence, 3))
print("ROI fallback executed:", result.roi_fallback_used)
print("Preprocess time (ms):", result.preprocess_ms)
print("OCR time (ms):", result.ocr_ms)
print("Primary header lines:", result.primary_header_lines)
print("Secondary body lines:", result.secondary_body_lines)
for line in result.lines:
    print({
        "text": line.text,
        "confidence": round(line.confidence, 3),
        "height": line.height,
        "zone": line.zone,
        "box": line.box,
    })
'@ | & $Python -
```

The ROI fallback flag is true when the retry ran. It is expected to remain false when first-pass mean confidence is at least `0.70`. Compare the printed recognized text and zones with the photo; glare, blur, packaging, and camera angle can affect real OCR quality.

## 5. Optional HTTP endpoint check

To test the existing app route with a live image:

1. Start PostgreSQL and confirm the backend `.env` points to the local database with FDA medicine records loaded.
2. From the repository root, start the backend:

   ```powershell
   & $Python -m uvicorn main:app --app-dir back-end\app --reload --host 127.0.0.1 --port 8000
   ```

3. Open `http://127.0.0.1:8000/docs`.
4. Expand `POST /api/v1/ocr/extract-label`, choose **Try it out**, attach a medicine-label image, and execute.
5. Confirm the request returns HTTP 200 and inspect the extracted entities and suggested FDA medicines.

The HTTP response currently uses the existing API schema; the structured OCR timings and line zones are available through the direct probe in Step 4 and are not added to the API response by this change.
