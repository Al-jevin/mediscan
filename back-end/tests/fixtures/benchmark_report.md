# Mediscan OCR Ablation Benchmark

Overall ablation status: **unconfirmed**.
Stages are confirmed only when each response reports the requested `telemetry.stage`.

| Requested stage | Confirmed | Entity F1 | Dosage accuracy | Unsafe high-trust rate | Mean ms | p95 ms |
|---:|:---:|---:|---:|---:|---:|---:|
| 0 | no | 41.86% | 10.00% | 0.00% | 1165.57 | 1561.41 |
| 1 | no | 41.86% | 10.00% | 0.00% | 1021.42 | 1397.41 |
| 2 | no | 41.86% | 10.00% | 0.00% | 1054.03 | 1311.60 |

Targets: entity F1 >= 88%; dosage accuracy >= 92%; unsafe high-trust rate = 0%; mean and p95 latency < 1,200 ms.
Latency is measured client-side end-to-end. Missing expected labels are excluded from the corresponding accuracy denominator.
