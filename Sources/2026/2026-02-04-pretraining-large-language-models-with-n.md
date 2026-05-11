---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/abs/2509.25149
tags: [llm, pretraining, quantization, nvfp4, low-precision]
---

# [2026-02-04] Pretraining Large Language Models with NVFP4

## TL;DR

[[NVIDIA]] paper (arXiv:2509.25149, v2 Mar 2026) — first publicly documented end-to-end pretraining of a 12B-parameter model on 10T tokens in 4-bit floating point ([[NVFP4]]). Achieves loss + downstream-task accuracy parity with an [[FP8]] baseline by combining four tricks: Random Hadamard transforms to bound outliers, 2D quantization shared by forward+backward, stochastic rounding for unbiased gradients, and selective high-precision layers. Positions FP4 as the next obvious narrow-precision step after FP8 became standard.

## Key claims

- A frontier-model training run costs **tens to hundreds of yottaflops** today — pretraining-efficiency is a first-class lever for the next generation.
- FP8 pretraining is "now widely adopted"; the open problem was FP4 stability over long token horizons.
- The recipe has four components, all needed: **Random Hadamard transforms (RHT)** to flatten block-level outliers before quantizing; **2D quantization** so forward + backward see consistent representations; **stochastic rounding** for unbiased gradient estimation; **selective high-precision layers** (the layers that wouldn't tolerate FP4 stay in higher precision).
- Validated at 12B params × 10T tokens — explicitly **the longest 4-bit pretraining run publicly documented to date.**
- Training loss + downstream evals are comparable to an FP8 baseline, not just close — the framing is "parity, with the speedup essentially free."
- NVIDIA-led with 89+ authors — institutional bet on FP4 becoming the next default training precision (post-Blackwell/Rubin).

## Entities touched

[[NVIDIA]], [[NVFP4]], [[FP8]]

## Topics touched

[[Low-Precision Training]], [[LLM Pretraining]]

## Open questions

- The four ingredients are listed as a recipe but the ablation surface isn't covered in the abstract. Which is the load-bearing one — RHT, 2D quant, or stochastic rounding?
- "Selective high-precision layers" — which layers, and what's the selection criterion? Token embedding, lm_head, residual streams? (The detail is in the paper body, not visible here.)
- 12B × 10T validates the recipe at that scale. Does the same recipe survive at 100B+, or does the outlier surface re-emerge?
- How does this interact with [[MoE]] — the expert layers are likely candidates for high-precision retention, but the paper's headline numbers don't decompose by architecture.
- Comparison vs. FP4 work from other labs (DeepSeek's UE8M0, Microsoft's MX) — abstract claims "novel approach" but not "first."

## Raw source

[arxiv.org/abs/2509.25149](https://arxiv.org/abs/2509.25149) — abstract only; full PDF + HTML available at the same URL.
