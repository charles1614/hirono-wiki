---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/ForceInjection/AI-fundermentals/blob/main/inference-solution/DeepSeek-V3-MoE-vLLM-H20-Deployment.md
tags: [inference, moe, parallelism, production-deployment, gpu]
---

# [2025-08-20] DeepSeek-V3 MoE vLLM H20 Deployment — Theoretical Analysis (Updated with Tencent Data)

## TL;DR

A detailed theoretical analysis of deploying [[DeepSeek-V3]] (671B MoE) on 32×[[H20]] GPUs with [[vLLM]], updated with real benchmark data from Tencent Taiji team's 15,800+ tokens/s record on 16 H20s. Concludes that the original 50,000 tokens/s / 200-concurrency / 32K-context SLO is partially unachievable with 32 cards, and recommends adjusting targets to 30,000–35,000 tokens/s.

## Key claims

- Recommended parallel config: EP=32, TP=1, PP=1 — 256 routed experts distributed 8 per GPU; TP=1 avoids all-reduce overhead but means KV-Cache cannot be sharded, increasing per-GPU VRAM pressure.
- Per-GPU VRAM: 83.2–92.3 GB on 96 GB H20; KV cache per 32K session = 3.812 GB, limiting concurrency at 32K context to 1 session/GPU (32 total vs. 200-session target).
- 32-card throughput projected at 26,860–40,527 tokens/s (linear scale from Tencent's 15,800 tokens/s on 16 cards with 85–95% scaling efficiency) — 19–46% below the 50,000 target.
- TTFT at 32K context is 280 ms — well below the P50 < 0.8 s target.
- Key recommendation: reduce context to 8K–16K tokens to support 50–100 concurrent sessions, or scale hardware to 40–50 GPUs to meet original SLO.
- DeepSeek-V3 architecture: 671B total params, 37B activated per token; 61 layers (58 MoE + 3 dense); 257 experts/layer (256 routed + 1 shared); 9 experts activated per token.

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

Provides a quantitative capacity-planning framework for MoE serving on H20 clusters, with specific VRAM accounting and concurrency formulas; directly applicable to any team planning DeepSeek-V3 or similar 600B+ MoE deployments.

## Entities touched

[[DeepSeek-V3]], [[vLLM]], [[H20]], [[Expert Parallelism]], [[MoE]], [[MLA]]

## Topics touched

[[MoE Serving]], [[Inference Disaggregation]], [[KV Cache Management]], [[Parallelism Strategies]]

## Raw source

[github.com/ForceInjection/AI-fundermentals/.../DeepSeek-V3-MoE-vLLM-H20-Deployment.md](https://github.com/ForceInjection/AI-fundermentals/blob/main/inference-solution/DeepSeek-V3-MoE-vLLM-H20-Deployment.md) — GitHub markdown document by ForceInjection, published 2025-08-20. Read 2026-05-15.
