---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://arxiv.org/abs/2509.25149
tags: [pretraining, low-precision, quantization, paper]
---

# [2026-02-04] Pretraining Large Language Models with NVFP4

## TL;DR

NVIDIA paper (89-author group led by Felix Abecassis et al., arXiv:2509.25149, v1 Sep 29 2025, v2 Mar 4 2026) — **first publicly documented 12B-parameter LLM pretrained on 10 trillion tokens in 4-bit floating-point precision (NVFP4)**, matching FP8 training loss and downstream accuracy. Combines four ingredients: **Random Hadamard transforms (RHT)** to bound block-level outliers, **2-D quantization scheme** for consistent forward/backward representations, **stochastic rounding** for unbiased gradient estimation, and **selective high-precision layers** for the stability-critical operators. The longest 4-bit pretraining run ever published.

## Key claims

(Abstract-level only — this entry summarizes the arxiv `/abs/` page; the PDF was not fetched in the corpus.)

- **Motivation**: frontier LLM training is now "tens to hundreds of yottaflops" of compute. **Cutting from FP8 → FP4 doubles arithmetic density** on tensor-core HW — but quantization-at-this-level threatens stability, convergence, and implementation correctness, especially at long token horizons.
- **Headline empirical result**: a **12B model trained on 10T tokens** with NVFP4 matches an FP8 baseline on training loss + downstream task accuracies. **Longest 4-bit pretraining run publicly documented to date.**
- **Four-ingredient method**:
  1. **Random Hadamard transforms (RHT)** — applied per-block to bound outliers before quantization. Mixing block elements via the Hadamard matrix spreads heavy-tail mass, making block-scale FP4 quantization much more accurate.
  2. **Two-dimensional quantization scheme** — ensures the forward-pass and backward-pass representations are consistent. (Many prior FP4 schemes that worked forward-only failed on the backward path because matmul transposes change the scale structure.)
  3. **Stochastic rounding** for gradient updates — preserves expected value (unbiased) even at FP4's coarse grid. Deterministic rounding biases gradients near the quantization boundary, accumulating over millions of steps.
  4. **Selective high-precision layers** — strategic FP8/BF16 retention for the most-numerically-sensitive operators. Likely embedding, layer-norm, final softmax (paper details in the PDF, not in the abstract).
- **Context**: NVFP4 is NVIDIA's 4-bit FP format introduced on Blackwell (B200/GB200) tensor cores — distinct from generic E2M1 FP4 because of NVIDIA's specific block-scale + scale-factor encoding. The paper validates the *training* path; inference paths for NVFP4 are already mainstream.
- **Author scale**: 89 authors (NVIDIA-internal). Reflects a large engineering effort — pretraining infra changes, kernel additions, framework integration, eval at-scale.

## Visual observations

*No load-bearing images — figures inline-captioned in raw, no standalone images.*

PDF not in raw — re-fetch `arxiv.org/pdf/2509.25149` if FP4 quality-vs-FP8 curves / loss trajectory / RHT illustrations become load-bearing.

## What this changes

- **For pretraining economics**: if FP4 pretraining matches FP8 quality, **the next 8B-405B run on Blackwell could double effective throughput per dollar** vs the same hardware running FP8. This is the kind of finding that immediately reshapes cap-ex planning.
- **For NVIDIA's hardware positioning**: NVFP4 is Blackwell-specific. This paper is the existence proof that justifies the FP4 tensor-core silicon investment. Expect NVIDIA to lean hard on this for B200/GB200 marketing.
- **For framework authors**: the four-ingredient recipe (RHT + 2D quant + stochastic rounding + selective hi-precision) becomes the reference template for FP4 training. Watch Megatron-LM, JAX-MaxText, NeMo, and the China-side stacks (Pangu, Qwen) for these landing.
- **For competitive narrative**: TPU papers ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]], [[2026-01-09-google-tpus-explained-architecture-perfo]]) tout TPU efficiency. NVIDIA's counter is "FP4 doubles your effective throughput on Blackwell, narrowing the gap." The NVFP4 paper is the technical backbone of that counter-claim.

## Entities touched

[[NVIDIA]], [[NVFP4]], [[FP4]], [[FP8]], [[Random Hadamard Transform]], [[Stochastic Rounding]], [[Blackwell]], [[B200]], [[GB200]]

## Topics touched

[[LLM Training Systems]], [[Quantization]], [[Numerical Precision]], [[LLM Pretraining]]

## Raw source

[arxiv.org/abs/2509.25149](https://arxiv.org/abs/2509.25149) — 89-author NVIDIA paper, v2 March 4 2026 (typo fix + related-work expansion + author-list update). **Abstract only fetched in raw corpus** (URL is the `/abs/` page, not `/pdf/`). PDF available at [arxiv.org/pdf/2509.25149](https://arxiv.org/pdf/2509.25149). Read 2026-05-11.
