---
created: 2026-05-11
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 14
tier: active
---

# Llama

Meta's open-weight LLM family; LLaMA 1 (2023) -> LLaMA 2 -> Llama 3 / 3.1 / 3.3 (lowercase from v3.1); reference benchmark target for inference + training infra work.

## Synthesis


Meta's open-weight LLM family and the de facto reference workload for ML-systems papers across inference, hardware, and speculative-decoding research. In disaggregated serving studies, Llama-3.1-70B illustrates how decode tensor-parallelism scales from 2× to 64× as TTL tightens, while cross-model comparison across the 8B/70B/405B sizes establishes the principle that larger models benefit more from disaggregation due to the richer parallelism search space available when prefill and decode mappings are chosen independently. EAGLE-3's scaling-law discovery — that draft-model speedup grows proportionally with training-data scale, a relation absent in prior EAGLE generations — was first observed using Llama-Instruct 3.1 8B as the target on MT-bench, with the family further evaluated at Llama-Instruct 3.3 70B (4.12× mean speedup) and DeepSeek-R1-Distill-LLaMA 8B. The HKUST Hopper microbenchmark study uses Llama hidden sizes (7B: 4096, 13B: 5120, 70B: 8192) as the application-level benchmark for comparing FP8 versus FP16 performance through Transformer Engine's te.TransformerLayer, with SwiGLU and RMSNorm operators replaced by te.Linear and te.RMSNorm to engage FP8 Tensor Cores.


## Observations

- The disaggregation study analyzes Llama-3.1-70B in detail: **TP scales from 2× to 64×** as TTL tightens, mirroring DeepSeek-R1's tightening pattern. Llama 8B/70B/405B cross-comparison establishes the **"larger models benefit more from disaggregation"** finding (richer parallelism search space → more value in distinct prefill/decode mappings). — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- The model on which EAGLE-3's **scaling-law discovery** was first observed: Llama-Instruct 3.1 8B as target on MT-bench, with draft-model speedup growing proportionally with training-data scale (a relation not present for EAGLE / EAGLE-2). EAGLE-3 also evaluated on Llama-Instruct 3.3 70B (mean 4.12× speedup) and DeepSeek-R1-Distill-LLaMA 8B. — [[2025-10-09-eagle-3-scalingupinference-acceleration-]]
- Application-level benchmark in HKUST's Hopper microbenchmark study — Llama 7B (hidden=4096), 13B (5120), 70B (8192) hidden sizes used for `te.TransformerLayer` FP8 vs FP16 latency comparison. SwiGLU + RMSNorm replacements via `te.Linear` and `te.RMSNorm` to engage Transformer Engine. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- Raschka's survey uses Llama 3 as the canonical baseline architecture (Pre-Norm, GQA, RoPE, SwiGLU) against which 2025 models are compared. Llama 4 Maverick (400B, 17B active) adopted MoE with a classic setup: 2 active experts with hidden size 8192 (fewer, larger than DeepSeek V3's 8 active at 2048 hidden), and alternates MoE and dense blocks every other transformer layer (vs DeepSeek's MoE-in-nearly-all-layers). Uses GQA not MLA. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Llama-4 Scout 17B×16 MoE used to validate [[ScaleRL]]; at 100K GPU-hours it showed predictable sigmoid-saturation scaling curves and achieved far higher asymptotic RL reward than the 8B dense model with 1/6th the RL compute. — [[2025-10-19-meta用40万个gpu小时做了一个实验-只为弄清强化学习scaling-law]]
- Datawhale/Raschka survey (Jul 2025): Llama 3 used as the canonical Pre-Norm+GQA+RoPE+SwiGLU baseline; Llama 4 Maverick (400B total, 17B active) uses MoE with 2 active experts of hidden=8192 (fewer, larger than DeepSeek V3's 8 active at 2048) and alternates MoE and dense blocks every other layer. Qwen3 dense models are architecturally deeper (more layers) but narrower than Llama 3. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- Pedagogical re-implementation of a scaled-down Llama on TinyShakespeare (~1M chars) incrementally adds [[RMSNorm]] pre-normalization, [[RoPE]] rotary embeddings with causal masking, and [[SwiGLU]] activation; final 4-layer model with 2.37M parameters reaches validation loss 1.0 (choosing among ~2.7 tokens). Without the causal mask, the model collapses to loss 0.16 by attending to future tokens — a deceptive false-positive for quality. — [[2025-05-20-llama-from-scratch-or-how-to-implement-a]]
