"""Run labeled OCR evaluations against the Mediscan OCR endpoint.

The current API does not expose a stage selector or report telemetry.stage.
Stage requests are therefore marked unconfirmed unless the response explicitly
reports the requested stage; the runner never presents unverified runs as an
ablation.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx

STAGES = (0, 1, 2)
DEFAULT_BASE_URL = "http://127.0.0.1:8000/api/v1"
ENTITY_FIELDS = ("medicine_name", "dosage", "frequency", "expiry_date")


class BenchmarkError(Exception):
    """Raised when the manifest or endpoint response is unusable."""


def _normalized(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).casefold().split())


def _load_manifest(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BenchmarkError(f"Could not read manifest {path}: {error}") from error
    samples = payload.get("samples") if isinstance(payload, dict) else None
    if not isinstance(samples, list) or not samples:
        raise BenchmarkError("Manifest must contain a non-empty 'samples' array.")

    validated = []
    for index, sample in enumerate(samples):
        if not isinstance(sample, dict):
            raise BenchmarkError(f"Sample {index} must be a JSON object.")
        image = sample.get("image")
        expected = sample.get("expected")
        if not isinstance(image, str) or not image:
            raise BenchmarkError(f"Sample {index} needs a non-empty 'image' path.")
        if not isinstance(expected, dict):
            raise BenchmarkError(f"Sample {index} needs an 'expected' object.")
        entities = expected.get("entities", {})
        if not isinstance(entities, dict):
            raise BenchmarkError(f"Sample {index} expected.entities must be an object.")
        image_path = Path(image)
        if not image_path.is_absolute():
            image_path = path.parent / image_path
        if not image_path.is_file():
            raise BenchmarkError(f"Sample {index} image does not exist: {image_path}")
        validated.append(
            {
                "id": str(sample.get("id") or f"sample-{index + 1}"),
                "image_path": image_path,
                "expected": expected,
                "entities": entities,
            }
        )
    return validated


def _post_image(
    client: httpx.Client,
    endpoint: str,
    image_path: Path,
    stage: int,
) -> tuple[dict[str, Any], float]:
    try:
        with image_path.open("rb") as image_file:
            started = time.perf_counter()
            response = client.post(
                f"{endpoint}?{urlencode({'stage': stage})}",
                files={"file": (image_path.name, image_file)},
            )
            elapsed_ms = (time.perf_counter() - started) * 1000
    except OSError as error:
        raise BenchmarkError(f"Could not read image {image_path}: {error}") from error
    except httpx.HTTPError as error:
        raise BenchmarkError(f"OCR request failed for {image_path.name}: {error}") from error

    if response.is_error:
        detail = response.text[:500]
        raise BenchmarkError(
            f"OCR endpoint returned HTTP {response.status_code} for "
            f"{image_path.name}: {detail}"
        )
    try:
        payload = response.json()
    except ValueError as error:
        raise BenchmarkError(
            f"OCR endpoint returned invalid JSON for {image_path.name}."
        ) from error
    if not isinstance(payload, dict):
        raise BenchmarkError(f"OCR endpoint returned a non-object for {image_path.name}.")
    return payload, elapsed_ms


def _entity_counts(expected: dict[str, Any], actual: Any) -> tuple[int, int, int]:
    predicted = actual if isinstance(actual, dict) else {}
    true_positive = false_positive = false_negative = 0
    for field in ENTITY_FIELDS:
        expected_value = _normalized(expected.get(field))
        actual_value = _normalized(predicted.get(field))
        if expected_value and expected_value == actual_value:
            true_positive += 1
        else:
            if expected_value:
                false_negative += 1
            if actual_value:
                false_positive += 1
    return true_positive, false_positive, false_negative


def _best_medicine(payload: dict[str, Any]) -> dict[str, Any] | None:
    suggestions = payload.get("suggested_medicines")
    if not isinstance(suggestions, list) or not suggestions:
        return None
    return suggestions[0] if isinstance(suggestions[0], dict) else None


def _matches_expected_drug(expected: dict[str, Any], medicine: dict[str, Any] | None) -> bool | None:
    expected_registration = expected.get("fda_registration_id")
    expected_approval = expected.get("fda_approval_id")
    if not expected_registration and not expected_approval:
        return None
    if medicine is None:
        return False
    return all(
        medicine.get(field) == expected_value
        for field, expected_value in (
            ("fda_registration_id", expected_registration),
            ("fda_approval_id", expected_approval),
        )
        if expected_value
    )


def _matches_expected_dosage(expected: dict[str, Any], medicine: dict[str, Any] | None) -> bool | None:
    expected_dosage = expected.get("dosage")
    if not expected_dosage:
        return None
    actual_dosage = medicine.get("fda_dosage_strength") if medicine else None
    return _normalized(expected_dosage) == _normalized(actual_dosage)


def _ratio(correct: int, total: int) -> float | None:
    return correct / total if total else None


def _percent(value: float | None) -> float | None:
    return round(value * 100, 2) if value is not None else None


def _p95(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def _evaluate_stage(
    client: httpx.Client,
    endpoint: str,
    samples: list[dict[str, Any]],
    stage: int,
    warmups: int,
) -> dict[str, Any]:
    if samples and warmups:
        for _ in range(warmups):
            _post_image(client, endpoint, samples[0]["image_path"], stage)

    tp = fp = fn = 0
    drug_results: list[bool] = []
    dosage_results: list[bool] = []
    unsafe_high_trust = unsafe_mismatches = 0
    trust_scores_seen = True
    latencies: list[float] = []
    stage_confirmed = True
    rows = []

    for sample in samples:
        payload, elapsed_ms = _post_image(client, endpoint, sample["image_path"], stage)
        expected = sample["expected"]
        counts = _entity_counts(sample["entities"], payload.get("entities"))
        tp += counts[0]
        fp += counts[1]
        fn += counts[2]
        medicine = _best_medicine(payload)
        drug_correct = _matches_expected_drug(expected, medicine)
        dosage_correct = _matches_expected_dosage(expected, medicine)
        if drug_correct is not None:
            drug_results.append(drug_correct)
        if dosage_correct is not None:
            dosage_results.append(dosage_correct)

        telemetry = payload.get("telemetry")
        telemetry = telemetry if isinstance(telemetry, dict) else {}
        reported_stage = telemetry.get("stage")
        stage_confirmed &= reported_stage == stage
        trust_score = telemetry.get("trust_score")
        if not isinstance(trust_score, (int, float)):
            trust_scores_seen = False
        else:
            mismatch = drug_correct is False or dosage_correct is False
            if mismatch:
                unsafe_mismatches += 1
                if trust_score >= 0.85:
                    unsafe_high_trust += 1

        latencies.append(elapsed_ms)
        rows.append(
            {
                "sample_id": sample["id"],
                "entity_counts": {"tp": counts[0], "fp": counts[1], "fn": counts[2]},
                "drug_correct": drug_correct,
                "dosage_correct": dosage_correct,
                "trust_score": trust_score if isinstance(trust_score, (int, float)) else None,
                "latency_ms": round(elapsed_ms, 2),
                "reported_stage": reported_stage,
            }
        )

    precision = _ratio(tp, tp + fp)
    recall = _ratio(tp, tp + fn)
    entity_f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and precision + recall
        else 0.0
    )
    dosage_accuracy = _ratio(sum(dosage_results), len(dosage_results))
    drug_accuracy = _ratio(sum(drug_results), len(drug_results))
    return {
        "requested_stage": stage,
        "reported_stage_confirmed": stage_confirmed,
        "ablation_status": "confirmed" if stage_confirmed else "unconfirmed",
        "sample_count": len(samples),
        "entity_extraction": {
            "precision": _percent(precision),
            "recall": _percent(recall),
            "f1": _percent(entity_f1),
            "target_percent": 88.0,
            "meets_target": entity_f1 >= 0.88,
        },
        "dosage_match_accuracy_percent": _percent(dosage_accuracy),
        "dosage_match_accuracy_target_percent": 92.0,
        "dosage_match_accuracy_meets_target": (
            dosage_accuracy >= 0.92 if dosage_accuracy is not None else False
        ),
        "drug_match_accuracy_percent": _percent(drug_accuracy),
        "unsafe_high_trust_rate_percent": (
            _percent(_ratio(unsafe_high_trust, unsafe_mismatches))
            if trust_scores_seen
            else None
        ),
        "unsafe_high_trust_target_percent": 0.0,
        "unsafe_high_trust_meets_target": (
            unsafe_high_trust == 0 if trust_scores_seen else False
        ),
        "unsafe_mismatch_count": unsafe_mismatches,
        "unsafe_high_trust_count": unsafe_high_trust,
        "warm_latency_ms": {
            "mean": round(statistics.fmean(latencies), 2) if latencies else None,
            "p95": round(_p95(latencies), 2) if latencies else None,
            "measurement": "client end-to-end wall-clock",
            "target_ms": 1200,
            "mean_meets_target": statistics.fmean(latencies) < 1200 if latencies else False,
            "p95_meets_target": _p95(latencies) < 1200 if latencies else False,
        },
        "results": rows,
    }


def _markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Mediscan OCR Ablation Benchmark",
        "",
        f"Overall ablation status: **{report['ablation_status']}**.",
        "Stages are confirmed only when each response reports the requested `telemetry.stage`.",
        "",
        "| Requested stage | Confirmed | Entity F1 | Dosage accuracy | Unsafe high-trust rate | Mean ms | p95 ms |",
        "|---:|:---:|---:|---:|---:|---:|---:|",
    ]
    for result in report["stages"]:
        entity_f1 = result["entity_extraction"]["f1"]
        latency = result["warm_latency_ms"]
        values = (
            result["requested_stage"],
            "yes" if result["reported_stage_confirmed"] else "no",
            f"{entity_f1:.2f}%" if entity_f1 is not None else "N/A",
            f"{result['dosage_match_accuracy_percent']:.2f}%"
            if result["dosage_match_accuracy_percent"] is not None
            else "N/A",
            f"{result['unsafe_high_trust_rate_percent']:.2f}%"
            if result["unsafe_high_trust_rate_percent"] is not None
            else "N/A",
            f"{latency['mean']:.2f}" if latency["mean"] is not None else "N/A",
            f"{latency['p95']:.2f}" if latency["p95"] is not None else "N/A",
        )
        lines.append("| " + " | ".join(map(str, values)) + " |")
    lines.extend(
        [
            "",
            "Targets: entity F1 >= 88%; dosage accuracy >= 92%; unsafe high-trust rate = 0%; "
            "mean and p95 latency < 1,200 ms.",
            "Latency is measured client-side end-to-end. Missing expected labels are excluded from "
            "the corresponding accuracy denominator.",
            "",
        ]
    )
    return "\n".join(lines)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path, help="Labeled benchmark manifest JSON.")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("MEDISCAN_API_URL", DEFAULT_BASE_URL),
        help="API v1 base URL (default: MEDISCAN_API_URL or localhost).",
    )
    parser.add_argument("--output-json", type=Path, help="Write full results to this JSON file.")
    parser.add_argument("--output-markdown", type=Path, help="Write the summary table to this Markdown file.")
    parser.add_argument("--timeout", type=float, default=120.0, help="Per-request timeout in seconds.")
    parser.add_argument("--warmups", type=int, default=1, help="Warm-up requests per stage before measurement.")
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be positive.")
    if args.warmups < 0:
        parser.error("--warmups cannot be negative.")
    return args


def main() -> int:
    args = _parse_args()
    try:
        samples = _load_manifest(args.manifest)
        endpoint = args.base_url.rstrip("/") + "/ocr/extract-label"
        with httpx.Client(timeout=args.timeout) as client:
            stages = [
                _evaluate_stage(client, endpoint, samples, stage, args.warmups)
                for stage in STAGES
            ]
        confirmed = all(stage["reported_stage_confirmed"] for stage in stages)
        report = {
            "ablation_status": "confirmed" if confirmed else "unconfirmed",
            "endpoint": endpoint,
            "sample_count": len(samples),
            "stages": stages,
        }
        markdown = _markdown_report(report)
        print(markdown)
        if args.output_json:
            args.output_json.parent.mkdir(parents=True, exist_ok=True)
            args.output_json.write_text(
                json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
        if args.output_markdown:
            args.output_markdown.parent.mkdir(parents=True, exist_ok=True)
            args.output_markdown.write_text(markdown, encoding="utf-8")
        return 0
    except BenchmarkError as error:
        print(f"Benchmark failed: {error}", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"Could not write benchmark output: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
