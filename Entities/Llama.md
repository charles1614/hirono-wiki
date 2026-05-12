---
created: 2026-05-11
updated: 2026-05-11
synthesis_updated_at: 2026-05-12
type: entity
refs: 3
tier: active
---

# Llama

Meta's open-weight LLM family; LLaMA 1 (2023) -> LLaMA 2 -> Llama 3 / 3.1 / 3.3 (lowercase from v3.1); reference benchmark target for inference + training infra work.

## Synthesis

Meta's open-weight LLM family — the de facto reference workload for ML-systems papers. **Disaggregation** behavior characterized at Llama-3.1-70B (TP scales from 2× to 64× as TTL tightens) and Llama 8B/70B/405B (larger models benefit more from disaggregated serving due to richer parallelism search space). **EAGLE-3 scaling-law** first observed on Llama-Instruct 3.1 8B (the 8B target paired with the surprising "more training data → more draft-model speedup" curve); evaluated also on Llama-Instruct 3.3 70B + DeepSeek-R1-Distill-LLaMA 8B. **HKUST H100 microbenchmark** uses Llama 7B/13B/70B hidden sizes (4096/5120/8192) for `te.TransformerLayer` FP8 vs FP16 application-level latency comparison.

## Observations

- The disaggregation study analyzes Llama-3.1-70B in detail: **TP scales from 2× to 64×** as TTL tightens, mirroring DeepSeek-R1's tightening pattern. Llama 8B/70B/405B cross-comparison establishes the **"larger models benefit more from disaggregation"** finding (richer parallelism search space → more value in distinct prefill/decode mappings). — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- The model on which EAGLE-3's **scaling-law discovery** was first observed: Llama-Instruct 3.1 8B as target on MT-bench, with draft-model speedup growing proportionally with training-data scale (a relation not present for EAGLE / EAGLE-2). EAGLE-3 also evaluated on Llama-Instruct 3.3 70B (mean 4.12× speedup) and DeepSeek-R1-Distill-LLaMA 8B. — [[2025-10-09-eagle-3-scalingupinference-acceleration-]]
- Application-level benchmark in HKUST's Hopper microbenchmark study — Llama 7B (hidden=4096), 13B (5120), 70B (8192) hidden sizes used for `te.TransformerLayer` FP8 vs FP16 latency comparison. SwiGLU + RMSNorm replacements via `te.Linear` and `te.RMSNorm` to engage Transformer Engine. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
