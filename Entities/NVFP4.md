---
created: 2026-05-11
updated: 2026-05-11
type: entity
refs: 1
tier: active
---

# NVFP4

NVIDIA's 4-bit floating-point format introduced with Blackwell; positioned as the next standard low-precision training format after FP8.

## Synthesis

NVIDIA's 4-bit floating-point format on Blackwell — distinct from generic E2M1 FP4 because of NVIDIA's specific block-scale + scale-factor encoding. The Sept-2025 NVIDIA paper (89 co-authors) provides the **first publicly documented 12B-parameter LLM pretrained on 10 trillion tokens in 4-bit precision** that matches FP8 training loss + downstream accuracy. Four-ingredient recipe: **Random Hadamard transforms** (bound outliers), **2-D quantization** (consistent forward/backward), **stochastic rounding** (unbiased gradients), and **selective high-precision layers** (BF16/FP8 retention for stability-sensitive ops).

## Observations

- The four-ingredient method that makes 4-bit pretraining work: (1) Random Hadamard transforms per-block to bound outliers; (2) 2-D quantization scheme for forward/backward consistency (prior FP4 schemes failed on the backward path because matmul transposes change scale structure); (3) stochastic rounding for unbiased gradients across millions of steps; (4) selective high-precision layers for the stability-critical operators (embedding, layer-norm, final softmax). Validated at **12B parameters × 10T tokens** — longest 4-bit pretraining run publicly documented. — [[2026-02-04-pretraining-large-language-models-with-n]]
