# MediScan Vault — Metric-Driven OCR & NER Polishing Sprint Plan

**Objective:** Upgrade the **PaddleOCR + NER + PostgreSQL (`fda_medicines`)** pipeline so every algorithmic improvement produces **verifiable quantitative metrics**—both in a reproducible 3-stage ablation report for your defense slides and in a live **Pipeline Telemetry Drawer** visible to panelists during your phone demo.

---

## 1. Core Defense Metrics & Target KPIs

To convince a technical panel that your improvements are real rather than cherry-picked, track these **five metrics** across every code change:

| Metric | Formula / Definition | Baseline Expectation | Defense Target | What It Proves to the Panel |
| :--- | :--- | :--- | :--- | :--- |
| **1. Active Ingredient CER** | $\text{CER} = \frac{S + D + I}{N}$ (substitutions, deletions, insertions over ground-truth length $N$) | $\approx 15\% - 25\%$ (glare/typos) | **$< 4.0\%$** | OpenCV preprocessing + `fda_medicines` snapping eliminates character-level OCR errors. |
| **2. Dosage Exact-Match Accuracy** | $\%$ of scans where numeric strength and unit (e.g., `500 mg`, `100 mg/5 mL`) match ground truth | $\approx 60\% - 70\%$ | **$\ge 92.0\%$** | Packaging distractor regexes prevent tablet counts (`100s`) and FDA codes (`DR-XY...`) from corrupting dosage. |
| **3. End-to-End Entity $F_1$-Score** | Harmonic mean of Precision and Recall across `(generic_name, dosage_strength, dosage_form)` | $\approx 0.65$ | **$\ge 0.88$** | Spatial prominence ranking + domain NER extracts complete, structured medication records. |
| **4. Unsafe Auto-Save Rate (UASR)** | $\text{UASR} = \frac{\text{Incorrect Scans with } \text{TrustScore} \ge 0.85}{\text{Total Scans}} \times 100\%$ | Unbounded (auto-saves errors) | **$0.0\%$** | **Patient-safety guardrail:** low-clarity or conflicting scans never silently write wrong dosages to `vault_items`. |
| **5. End-to-End Pipeline Latency** | Total wall-clock time from image receipt to structured JSON response (`OpenCV + OCR + NER + DB`) | N/A | **$< 1,200\text{ ms}$** | Pipeline remains responsive for real-time mobile scanning without cloud LLM delays. |

---

## 2. Making the Metrics Visible to the Panel (Two Proof Channels)

Improvements that stay hidden inside backend logs will not score points during a 10-minute defense. Surface your metrics through two visible channels:

### Channel A: Live "Scan Telemetry" Drawer in Expo (During the Live Demo)
Add a collapsible **"View Pipeline Telemetry"** accordion inside the Expo Scan Confirmation Modal (and `/crud-tester/` workbench) so panelists can inspect the live numbers on any physical box or blister pack they hand you:
- **Raw OCR vs. Grounded Output Diff:** Displays `"Paracetam0l 5OOmg"` $\rightarrow$ `"Paracetamol 500 mg"` side by side so the panel sees the correction happen in real time.
- **Active Preprocessing & Fallback Badges:** Shows whether `CLAHE` glare reduction or the $70\%$ center-ROI second pass triggered.
- **Composite Trust Score Breakdown:** Displays $C_{\text{ocr}}$ (OCR confidence), $S_{\text{fda}}$ (`rapidfuzz` catalog similarity), $M_{\text{dosage}}$ (dosage extraction flag), and the resulting $\text{TrustScore}$.
- **Per-Stage Latency Breakdown:** Prints `preprocess_ms`, `ocr_ms`, and `grounding_ms` right below the trust badge.

### Channel B: Reproducible 3-Stage Ablation Report (`docs/BENCHMARK_RESULTS.md`)
Run `back-end/tests/run_benchmark.py` across a frozen **30-image Philippine medication test set** and export a Markdown comparison table proving why each layer of your architecture exists:

| Pipeline Configuration | Tier 1: Clean Box ($n=10$) | Tier 2: Foil Glare ($n=10$) | Tier 3: Low Light / Tilt ($n=10$) | Dosage Exact-Match | Unsafe Auto-Save Rate | Avg. Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stage 0: Raw PaddleOCR + Naive Regex (Baseline)** | *Measure* | *Measure* | *Measure* | *Measure* | *Measure* | *Measure* |
| **Stage 1: + OpenCV CLAHE & Spatial Box Ranking** | *Measure* | *Measure* | *Measure* | *Measure* | *Measure* | *Measure* |
| **Stage 2: + Distractor Filter & `fda_medicines` Grounding** | *Measure* | *Measure* | *Measure* | *Measure* | *Measure* | *Measure* |

---

## 3. Team Track Division (Aligned to Metric Ownership)

Keep strict branch and file boundaries so teammates can work in parallel without merge conflicts:

| Track | Git Branch | Owned Files | Primary Metric Owned |
| :--- | :--- | :--- | :--- |
| **Track A: Image & OCR** | `feat/ocr-preprocessing` | `back-end/app/services/image_preprocess.py`, PaddleOCR service | **Tier-2 (Foil Glare) & Tier-3 (Low Light) CER** + `preprocess_ms` / `ocr_ms` telemetry |
| **Track B: NER & Catalog Grounding** | `feat/ner-fda-grounding` | `back-end/app/services/ner_extractor.py`, `catalog_grounding.py`, `requirements.txt` | **Dosage Exact-Match Accuracy ($\%$)**, **Entity $F_1$**, and **$\text{UASR} = 0.0\%$** |
| **Track C: Expo Telemetry UX** | `feat/scan-confidence-ux` | `front-end/src/screens/` & Scan Confirmation Modal | **Live Panel Visibility** (Green/Amber/Red trust gates + collapsible Telemetry Drawer) |
| **Track D: Benchmark & QA** | `test/ocr-ablation-bench` | `back-end/tests/run_benchmark.py`, `docs/BENCHMARK_RESULTS.md` | **Reproducible 3-Stage Ablation Table** across the 30-image Philippine test set |

> **Git Workflow Reminder:** Ensure PostgreSQL is running before every `git commit` so `pre-commit` updates `mediscan_full.sql`, and never commit changes to `.githooks/*` through GitHub Desktop.

---

## 4. Day-by-Day Polishing Schedule (Monday–Friday)

### Day 1 (Monday): Freeze the 30-Image Benchmark & Measure Baseline Numbers
You cannot prove improvement without a frozen starting line.
- [ ] **Assemble `back-end/tests/benchmark_set/` (30 local photos + `ground_truth.json`):**
  - **Tier 1 (10 images):** Clean front-facing Philippine medicine boxes (*Biogesic*, *Neozep*, *Bioflu*, *Amoxicillin*, *Losartan*) in normal indoor lighting.
  - **Tier 2 (10 images):** Curved silver/aluminum foil blister packs with overhead glare.
  - **Tier 3 (10 images):** Dim room lighting, $15^\circ - 30^\circ$ tilt, or small liquid bottle labels (`mg/5 mL`).
- [ ] **Build `back-end/tests/run_benchmark.py` and run Stage 0 (Baseline):**
  - Compute Active Ingredient CER, Dosage Exact-Match Accuracy, Entity $F_1$, and average latency on your current unmodified code.
  - Save these baseline numbers into `docs/BENCHMARK_RESULTS.md`—this becomes Row 1 of your defense slide table.

### Day 2 (Tuesday): OpenCV Image Conditioning & Spatial Box Ranking
Target Tier-2 (foil glare) and Tier-3 (low light) character drop errors.
- [ ] **Implement `preprocess_medication_image()` in `image_preprocess.py`:**
  - Upscale low-resolution captures where $\max(H, W) < 1000\text{ px}$ using bicubic interpolation (`cv2.INTER_CUBIC`).
  - Convert BGR to `LAB` color space and apply `CLAHE` (`clipLimit=2.5`, `tileGridSize=(8, 8)`) strictly on the `L` channel to equalize glare without washing out ink.
  - Apply `cv2.bilateralFilter(d=5, sigmaColor=50, sigmaSpace=50)` to smooth metallic blister grain while preserving sharp glyph edges.
- [ ] **Add Center-ROI Fallback & Spatial Prominence Ranking:**
  - If full-frame mean OCR confidence $C_{\text{ocr}} < 0.70$, automatically re-run OCR on the inner $70\%$ center crop and keep the higher-confidence pass (logging `roi_fallback_used: true` in telemetry).
  - Filter out detections with $C_{\text{ocr}} < 0.60$ and compute box prominence ratio:
    $$
    R_i = \frac{h_i}{\max_j(h_j)}
    $$
  - Separate **Primary Header Lines** ($R_i \ge 0.55$, where R.A. 6675 places generic/brand names) from **Fine Print** ($R_i < 0.55$).
- [ ] **Re-run `run_benchmark.py` (Stage 1)** and record the CER improvement on Tier 2 and Tier 3.

### Day 3 (Wednesday): Distractor Quarantine & `fda_medicines` Catalog Grounding
Eliminate false dosage extractions and snap noisy OCR strings to canonical database records.
- [ ] **Quarantine Philippine Packaging Distractors Before Dosage Extraction:**
  Strip non-dosage numbers before running dosage regexes so registration codes and tablet counts never pollute `dosage_strength`:
  ```python
  import re

  DISTRACTOR_PATTERNS = [
      # Philippine FDA Registration Numbers (e.g., DR-XY45123, DRP-1234)
      r"\b(?:DR|DRP|HRP|VR|VRP)-[A-Z0-9-]+\b",
      # Batch / Lot Numbers
      r"\b(?:LOT|BATCH|B\/N|BN)\s*[:#.-]?\s*[A-Z0-9-]+\b",
      # Expiry / Manufacturing Dates
      r"\b(?:EXP|MFG|EXPIRY)\s*[:.-]?\s*(?:\d{2}[\/-]\d{2,4}|[A-Z]{3}\s*\d{2,4})\b",
      # Pack Quantity / Tablet Counts (e.g., 100 Tablets, 10's, 30 caps)
      r"\b\d+\s*(?:tablets?|capsules?|tabs?|caps?|sachets?|ampoules?|vials?|'s)\b",
  ]

  def strip_packaging_distractors(text: str) -> str:
      cleaned = text
      for pattern in DISTRACTOR_PATTERNS:
          cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
      return re.sub(r"\s+", " ", cleaned).strip()
  ```
- [ ] **Add Context-Aware Glyph Normalization & Combination Dosage Regex:**
  - Inside alphabetic drug tokens: fix internal `0` $\rightarrow$ `o`, `1` $\rightarrow$ `i`, and split fused units (`500mg` $\rightarrow$ `500 mg`).
  - Inside numeric dosage tokens: fix `O`/`o` $\rightarrow$ `0`, `l`/`I` $\rightarrow$ `1`, `S`/`s` $\rightarrow$ `5` (`5OO mg` $\rightarrow$ `500 mg`).
  - Support single, liquid, and combination strengths (`500 mg`, `100 mg/5 mL`, `500 mg / 125 mg`).
- [ ] **Ground Against `fda_medicines` with Dosage-Safety Scoring (`rapidfuzz`):**
  - Match normalized header text against `"{generic_name} {brand_name}"` using `fuzz.token_set_ratio`.
  - Apply $+10$ points (capped at $100$) when extracted dosage matches the candidate row's `dosage_strength`, and $-20$ points when strengths conflict so `250 mg` is never silently swapped with `500 mg`.
- [ ] **Compute Composite `TrustScore` & Emit Full Telemetry JSON:**
  $$
  \text{TrustScore} = 0.40 \cdot C_{\text{ocr}} + 0.40 \cdot \left(\frac{S_{\text{fda}}}{100}\right) + 0.20 \cdot M_{\text{dosage}}
  $$
  Return `trust_score`, `trust_tier`, and a `telemetry` object (`raw_ocr_lines`, `cleaned_header`, `ocr_confidence`, `fda_match_score`, `roi_fallback_used`, `latency_ms`) in the FastAPI response.

### Day 4 (Thursday): Expo Telemetry Drawer & Full Ablation Run
Make the backend metrics visible on the phone screen and lock in your final slide numbers.
- [ ] **Build the Confidence-Gated UI & "Scan Telemetry" Drawer in Expo:**
  - **High Trust ($\text{TrustScore} \ge 0.85$):** Green **Verified FDA Match** badge; pre-fills canonical `fda_medicines` fields for one-tap save.
  - **Medium Trust ($0.65 \le \text{TrustScore} < 0.85$):** Amber **Review Suggested** badge; highlights fields with token confidence $< 0.75$ in amber for manual confirmation.
  - **Low Trust ($\text{TrustScore} < 0.65$):** Red **Low Scan Clarity** alert; blocks auto-save and offers **Retake Photo** or **Manual FDA Catalog Search**.
  - **Collapsible Telemetry Drawer:** Tapping *"Show Scan Metrics"* reveals Raw OCR Text, FDA Similarity ($\%$), OCR Confidence ($\%$), and Stage Latency (`ms`).
- [ ] **Run `run_benchmark.py` (Stage 2 — Full Pipeline) and verify $\text{UASR} = 0.0\%$:**
  - Export the completed 3-stage comparison table to `docs/BENCHMARK_RESULTS.md`.
  - Confirm that zero incorrect scans in the 30-image set crossed the $\text{TrustScore} \ge 0.85$ auto-save threshold.

### Day 5 (Friday): Defense Rehearsal & `main` Freeze
- [ ] **Calibrate Thresholds Under Room Lighting:** Test live phone scans under overhead fluorescent light using your exact physical demo props.
- [ ] **Prepare 3 Physical Demo Samples for Saturday:**
  1. **Sample 1 (Clean Box):** Demonstrates sub-second latency, $\ge 0.90$ `TrustScore`, and exact FDA catalog match.
  2. **Sample 2 (Glossy Foil Blister Pack):** Open the **Scan Telemetry Drawer** to show the panel how `CLAHE` + `rapidfuzz` corrected raw OCR glare errors into a verified drug record.
  3. **Sample 3 (Obscured / Low-Clarity Label):** Demonstrates the **Safety Guardrail** ($\text{UASR} = 0\%$) catching an ambiguous scan in Amber/Red instead of saving a wrong dosage.
- [ ] **Merge & Freeze `main`:** Merge all tracks into `main`, verify `git ls-tree HEAD .githooks/` shows `100755`, confirm `mediscan_full.sql` is clean, and freeze `main`.