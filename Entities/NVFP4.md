---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 4
tier: active
---

# NVFP4

NVIDIA's 4-bit floating-point format introduced with Blackwell; positioned as the next standard low-precision training format after FP8.

## Synthesis


NVFP4 is NVIDIA's 4-bit floating-point format introduced on Blackwell (B200/GB200) tensor cores, distinct from generic E2M1 FP4 through its specific block-scale and scale-factor encoding. A September 2025 NVIDIA paper (89 authors, arXiv:2509.25149) provides the first publicly documented 12B-parameter LLM pretrained end-to-end on 10 trillion tokens in 4-bit precision, matching FP8 training loss and downstream accuracy — the longest 4-bit pretraining run ever published. The method rests on four ingredients: Random Hadamard transforms applied per-block to bound outliers before quantization, a two-dimensional quantization scheme that keeps forward and backward representations consistent (prior FP4 approaches failed on the backward path because matmul transposes alter scale structure), stochastic rounding to keep gradient updates unbiased across millions of steps, and selective retention of high-precision BF16/FP8 for stability-critical operators such as embedding, layer-norm, and final softmax. Because FP4 doubles arithmetic density on tensor-core hardware relative to FP8, a successful pretraining path at this scale directly reshapes throughput-per-dollar projections for frontier training runs on Blackwell.


## Observations

- The four-ingredient method that makes 4-bit pretraining work: (1) Random Hadamard transforms per-block to bound outliers; (2) 2-D quantization scheme for forward/backward consistency (prior FP4 schemes failed on the backward path because matmul transposes change scale structure); (3) stochastic rounding for unbiased gradients across millions of steps; (4) selective high-precision layers for the stability-critical operators (embedding, layer-norm, final softmax). Validated at **12B parameters × 10T tokens** — longest 4-bit pretraining run publicly documented. — [[2026-02-04-pretraining-large-language-models-with-n]]
