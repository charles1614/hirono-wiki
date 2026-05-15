---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# GPU

Graphics Processing Unit — NVIDIA/AMD parallel compute accelerator used for ML training and inference

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Comparative TCO vs [[TPU]]: [[GB200]]/GB300 reverses TPUv7's cost advantage in Prefill (35–50% lower cost) via FP4 precision; LMSYS benchmark shows NVL72 GB200 at ~$0.047/M output tokens vs H100 ~$0.14/M; Switch Fabric (NVSwitch/Fat-tree) wins for MoE training (irregular all-to-all traffic), sub-100 chip experiments, and latency-sensitive inference. Decode bottleneck shifts from HBM bandwidth (small batch) to NVLink bandwidth (large batch). — [[2026-01-15-tpu-vs-gpu-全面技术对比-谁拥有-ai-算力最优解]]
