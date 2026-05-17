---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/gp6v6PuKLpMeJlBa_MEz_Q
tags: [inference, moe, quantization, gpu, microbenchmark]
---

# [2026-01-06] 142 TFLOPS 的差距：为什么在 Blackwell 上 FP4 MoE 算子工程至关重要

## TL;DR

Benchmarks a GPT-OSS-20B MoE model (32 experts, top-4, NVFP4) on a single Blackwell B200 across three inference backends. SGLang achieves 1168 TFLOPS peak vs vLLM's 1026 TFLOPS — a 142 TFLOPS gap — driven by three systematic kernel engineering choices: kernel fusion, Blackwell-native CUTLASS scheduling, and adaptive grid sizing for small-batch occupancy.

## Key claims

- On [[B200]] (`sm_100a`), [[SGLang]] peaks at **1168 TFLOPS**, [[FlashInfer]] at **1156 TFLOPS**, and [[vLLM]] at **1026 TFLOPS** for grouped GEMM with [[NVFP4]] [[MoE]] (GPT-OSS-20B, 32 experts, top-4).
- At batch size = 1 (interactive inference), SGLang is **1.84× faster** than vLLM; at batch size = 128, **1.25× faster** (4.1 s saved per 1000 tokens).
- vLLM's MoE forward requires **7 separate CUDA kernel launches** (shuffle → quant → GEMM1 → SiLU → quant → GEMM2 → shuffle); SGLang fuses the two shuffle+reduction steps into one kernel, reducing activation memory traffic by **21.9%** and kernel count from 7 to 5.
- SGLang uses [[CUTLASS]] schedule `KernelPtrArrayTmaWarpSpecialized1SmNvf4Sm100` targeting [[Blackwell]] `sm_100a`, providing native FP4 warp specialization, TMA async loads, and 128-byte alignment enforcement via padding; vLLM uses a generic CUTLASS 3.x schedule without Blackwell-specific padding.
- SGLang implements adaptive grid sizing: a `while` loop halves block size and doubles grid size until `grid.x > multiProcessorCount`, maximizing SM occupancy at tiny batch sizes where standard CUTLASS heuristics leave ~98.6% of SMs idle.
- FlashInfer's expert-first layout incurs heavy pre-processing (bincount, argsort, scatter) that dominates at batch sizes 1–16 but amortizes at BS=4096, matching SGLang within ~1%.
- At batch size = 128 with 24 layers and 1000 tokens, SGLang saves an estimated ~16.8 ms in activation bandwidth alone; real-world gains are higher due to kernel launch overhead reduction.
- DeepSeek-V3 scale (256 experts, top-8) closes the gap at large batch because higher natural parallelism saturates all SMs regardless of heuristic; small-batch advantage for SGLang persists.
- [[Expert Parallelism]] via DeepEP (SGLang's implementation) uses all-to-all dispatch → local GEMM → all-to-all combine; the 1.25×–1.84× single-card gains stack multiplicatively with multi-node EP.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-/weixin-img-001.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-/weixin-img-003.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-/weixin-img-004.png)

*Other images decorative — top-k=2 variant chart (weixin-img-002), DeepSeek-256-expert charts (weixin-img-005).*

## What this changes

Establishes that Blackwell FP4 MoE performance is determined almost entirely by kernel engineering rather than hardware availability, and that small-batch (BS=1–16) optimization requires Blackwell-specific CUTLASS schedules and adaptive launch heuristics — not just generic CUTLASS 3.x configurations.

## Entities touched

[[SGLang]], [[vLLM]], [[FlashInfer]], [[Blackwell]], [[B200]], [[NVFP4]], [[MoE]], [[CUTLASS]], [[Expert Parallelism]], [[DeepSeek-V3]]

## Topics touched

[[MoE Serving]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/gp6v6PuKLpMeJlBa_MEz_Q](https://mp.weixin.qq.com/s/gp6v6PuKLpMeJlBa_MEz_Q) — WeChat public account GiantPandaLLM, translated from advpropx on Substack, published 2026-01-06. Read 2026-05-15.
