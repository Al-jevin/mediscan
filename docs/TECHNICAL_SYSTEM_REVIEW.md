# MediScan Vault — Technical System Review

**Audience:** Technical reviewers, defense panelists, and engineers evaluating OCR/NER hardening.  
**Sources:** `OCR_NER_IMPROVEMENTS.md`, `docs/OCR_NER_PLAN.md`, `docs/OCR_REVISED_FINAL_PLAN.md`, `test_pilot.md`, `back-end/tests/fixtures/benchmark_report.md`, and the implemented services under `back-end/app/services/`.

---

## 1. System technical overview

MediScan Vault is a **local-first** medicine scanning stack:

| Layer | Technology | Role |
| --- | --- | --- |
| Client | React Native + Expo (Expo Go / APK) | Capture, review, vault, reminders |
| API | FastAPI (`/api/v1`) | Auth, OCR extract-label, vault, schedules |
| Vision | OpenCV + PaddleOCR | Image conditioning + text detection/recognition |
| NER / linking | Regex + heuristics + RapidFuzz | Entities → Philippine FDA catalog rows |
| Data | PostgreSQL (`philippines_fda_medicines`, ~31k rows) | Canonical medicine records |

End-to-end scan path:

```text
Phone image bytes
  → POST /api/v1/ocr/extract-label
  → image_preprocess (stage-gated)
  → vision / PaddleOCR (+ optional center-ROI retry)
  → nlp_service (distractor strip + dosage repair)
  → fda_matcher (RapidFuzz + safety-capped TrustScore)
  → OCRResponse + telemetry
  → Expo result UI (trust tier gates)
```

Design intent: stay under **~1.2 s** steady-state latency **without** cloud LLMs, while making **incorrect high-trust** suggestions mathematically hard (patient-safety first).

---

## 2. OCR / NER hardening architecture

Hardening is layered. Each stage exists to fix a known Philippine-packaging failure mode.

### 2.1 Stage model (ablation)

The OCR route supports `stage=0|1|2` for controlled comparison:

| Stage | What runs | Purpose |
| --- | --- | --- |
| **0** | Raw / minimal path | Baseline (naive extraction) |
| **1** | + OpenCV conditioning + spatial tagging | Beat glare / low light / clutter |
| **2** | + Distractor quarantine + FDA grounding + trust caps | Full production / safety path |

Non-full stages are intended for **localhost / controlled benchmark** use so mobile clients cannot bypass safety caps in production-style runs.

### 2.2 Image conditioning (`image_preprocess.py`)

| Technique | Technical reason |
| --- | --- |
| Cap longest edge ≤ **1280 px** (`INTER_AREA`) | Keeps DBNet/PaddleOCR latency inside the mobile budget |
| Upscale very small crops toward ~**1000 px** (`INTER_CUBIC`) | Recovers thin glyph strokes on small labels |
| **LAB** color space + **CLAHE** on L channel (`clipLimit=2.5`, `8×8`) | Equalizes foil/blister specular glare without washing ink chroma |
| **Bilateral filter** (`d=5`, σ color/space `50`) | Smooths metallic grain; preserves character edges |
| Optional **70% center ROI** from native buffer | Second pass when Pass-1 mean OCR confidence &lt; **0.70** |

Pilot verification (`test_pilot.md`): vision unit tests mock OCR; real probes report `preprocess_ms`, `ocr_ms`, `roi_fallback_used`, and primary/secondary zones.

### 2.3 Spatial prominence / “NER zoning” (`vision.py`)

PaddleOCR returns text **plus** boxes and confidences (geometry is retained, not discarded).

1. Drop low-confidence detections (threshold ~**0.60**).  
2. Compute height prominence  
   \[
   R_i = \frac{h_i}{\max_j h_j}
   \]  
3. Tag zones:  
   - **Primary header** — \(R_i \ge 0.50\) (often brand / large print)  
   - **Secondary body** — \(R_i &lt; 0.50\) (often generic name under R.A. 6675)

Why this matters technically: Philippine OTC packs often print the **brand larger than the generic**. Discarding small lines would delete the active ingredient. Zone weighting in matching (header ~1.00×, body ~0.92×) keeps generics in play.

### 2.4 Distractor quarantine & dosage NER (`nlp_service.py`)

Before dosage regexes run, packaging noise is stripped, including:

- FDA registration IDs (`DR-`, `DRP-`, `HRP-`, `VR-`, …)  
- Lot / batch tokens  
- Expiry / MFG date strings  
- Pack counts (`100 Tablets`, `10's`, …)  
- Common storage / warning boilerplate  

**Glyph repair is numeric-token-only** (`5OOmg` → `500 mg`). Alphabetic drug tokens are left alone so alphanumeric products (e.g. Vitamin B1/B6/B12) are not corrupted; residual name noise is left to RapidFuzz.

Supported dosage shapes include single, liquid (`mg/5 mL`), and combination strengths, with a dosage-line confidence \(C_{\text{dosage}}\).

### 2.5 Catalog grounding & safety-capped trust (`fda_matcher.py`)

Candidates are scored against FDA rows (generic/brand + strength) using fuzzy similarity, then a **composite trust**:

\[
\text{TrustScore}_{\text{raw}} =
0.40\,C_{\text{ocr}} +
0.40\,S_{\text{fda}} +
0.20\,M_{\text{dosage}}
\]

where \(C_{\text{ocr}}\in[0,1]\), \(S_{\text{fda}}\) is normalized catalog similarity, and \(M_{\text{dosage}}\in\{0,1\}\).

**Hard caps (patient safety):**

| Rule | Condition | Cap |
| --- | --- | --- |
| Dosage conflict | Extracted strength ≠ catalog strength (after canonicalize) | Trust ≤ **0.64** (low) |
| Weak / missing dose | No match **or** \(C_{\text{dosage}} &lt; 0.85\) | Trust ≤ **0.79** (medium) |

**Continuous tiers** (half-open intervals):

- **high** ≥ 0.85  
- **medium** ≥ 0.65 and &lt; 0.85  
- **low** &lt; 0.65  

Implication: an incorrect or conflicting dose **cannot** legitimately sit in the green one-tap tier. UI should require human confirmation even on high trust (pre-fill, not silent write).

---

## 3. Defense metrics (targets vs measured)

### 3.1 Target KPIs (from OCR/NER plans)

| Metric | Definition | Defense target |
| --- | --- | --- |
| Active ingredient CER | Char edit rate vs ground truth | &lt; **4%** |
| Dosage exact-match | Strength+unit exact | ≥ **92%** |
| Entity F1 | Precision/recall on name/strength/form | ≥ **0.88** |
| Unsafe high-trust rate (UASR) | Wrong answers with trust ≥ 0.85 | **0%** |
| E2E latency | Image in → JSON out | &lt; **1.2 s** (steady-state) |

### 3.2 Currently checked-in pilot numbers

From `back-end/tests/fixtures/benchmark_report.md` (small ablation fixture; stages marked **unconfirmed**):

| Stage | Entity F1 | Dosage accuracy | Unsafe high-trust | Mean ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 41.86% | 10.00% | **0.00%** | 1165 | 1561 |
| 1 | 41.86% | 10.00% | **0.00%** | 1021 | 1397 |
| 2 | 41.86% | 10.00% | **0.00%** | 1054 | 1311 |

**Technical reading for reviewers:**

- **Safety property (UASR = 0% on this fixture) is met** — the trust caps are doing their job on the recorded set.  
- **Extraction quality (F1 / dosage) is still below defense targets** on this pilot set; stages are also **unconfirmed** (telemetry stage echo / harness alignment still incomplete).  
- Latency mean is near the 1.2 s budget; **p95 exceeds** it on this run — expect variance with cold start, image size, and CPU.

Do **not** treat older draft figures (e.g. large-N “~85% field accuracy”) as measured fact unless a labelled set is re-scored against the current matcher.

---

## 4. How accuracy is proven (two channels)

### Channel A — Live telemetry

Plans and UI work aim to expose, per scan:

- Raw OCR vs cleaned/grounded strings  
- Whether CLAHE / ROI fallback fired  
- \(C_{\text{ocr}}\), dosage confidence, FDA similarity, composite trust  
- `preprocess_ms` / `ocr_ms` / grounding / total  

Backend can also print a structured audit block on the FastAPI console for side-by-side demo with the phone.

### Channel B — Ablation benchmark

`back-end/tests/run_benchmark.py` + fixture manifests:

- Warmup inference (PaddleOCR cold start is multi-second; first call excluded)  
- Stages 0/1/2 comparison  
- Live API + Postgres when available; offline CSV fallback when not  
- Export metrics used in defense tables  

**Reviewer ask:** prefer a frozen labelled photo set (clean / foil glare / low-light tiers) with stage confirmation before claiming Stage-2 uplift.

---

## 5. Adjacent technical controls (non-OCR but relevant)

| Area | Technical note |
| --- | --- |
| Upload hygiene | Size limits + decode/format rejection so bad bytes never hit OCR |
| Auth / ownership | Session tokens; profile/vault scoped to account |
| Mobile networking | Expo Go may reach API via Metro `:8081` proxy to FastAPI `:8000` (avoids Public Wi‑Fi Python inbound blocks) |
| Trust UX | High / medium / low gates — low blocks careless auto-save |

---

## 6. File map (hardening surface)

| File | Technical responsibility |
| --- | --- |
| `back-end/app/api/v1/ocr.py` | Extract-label endpoint, stage gate, audit logging |
| `back-end/app/services/image_preprocess.py` | Resize, CLAHE, bilateral, ROI crop |
| `back-end/app/services/vision.py` | PaddleOCR, dual-pass, spatial zones, OCR timing |
| `back-end/app/services/nlp_service.py` | Distractors, glyph repair, dosage patterns |
| `back-end/app/services/fda_matcher.py` | RapidFuzz grounding, trust formula + caps |
| `back-end/app/schemas/ocr.py` | Response / telemetry contracts |
| `back-end/tests/run_benchmark.py` | Ablation runner |
| `front-end/src/services/scanApi.ts` | Multipart upload + result mapping |
| `front-end/src/app/result.tsx` | Trust presentation / telemetry entry point |

---

## 7. Reviewer verdict (technical)

**Strengths**

- Clear **defense-oriented** pipeline: preprocess → OCR geometry → distractor-aware NER → catalog grounding → **hard trust caps**.  
- Safety metric (unsafe high-trust) is explicitly engineered, not only “best match” ranking.  
- Latency is treated as a first-class constraint (resolution cap, no cloud LLM dependency).  
- Philippine packaging realities (Generics Act layout, DR codes, blister glare) drive concrete algorithms, not generic OCR demos.

**Gaps / risks**

- Checked-in ablation still shows **low entity/dosage accuracy** and **unconfirmed stages** — architecture is ahead of the published scoreboard.  
- Need a **frozen, labelled** multi-tier image set and confirmed stage telemetry before claiming Stage-2 uplift on slides.  
- p95 latency and cold-start behavior should be stated honestly in demos (warmup vs steady-state).

**One-line summary for a technical panel**

> MediScan’s OCR/NER stack is a **safety-capped, locally runnable** Philippine-FDA grounding pipeline: OpenCV+PaddleOCR improve readability; distractor-aware NER and RapidFuzz attach catalog IDs; trust hard-caps prevent wrong high-confidence saves — while measured entity/dosage accuracy on the current pilot set still needs a larger confirmed benchmark to hit the published defense targets.

---

*This review describes technical design and measured pilot evidence as of the documents and fixtures above. Replace pilot rows when a confirmed ablation on the full labelled set is available.*
