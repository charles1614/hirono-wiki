---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/cclvT7PxQzdkm9nYfWbhmQ
tags: [inference, attention-kernels, gpu]
---

# [2025-04-09] FlashAttention-V3解读之Hopper GPU版FlashAttention (上篇)

## TL;DR

Technical deep-dive into FlashAttention-V3, reframing it as a Hopper-architecture adaptation of FlashAttention-V2 rather than an algorithmic innovation. Covers three key changes: warp-specialized producer/consumer async pipeline using TMA, GEMM-softmax overlap at both inter- and intra-warpgroup levels, and FP8 support (deferred to follow-up article).

## Key claims

- [[FlashAttention]]-V2 achieves only ~35% GPU utilization on H100 vs 80–90% for tuned [[Hopper]] GEMM kernels; V3 closes this gap by adopting Hopper-native hardware features ([[TMA]], [[WGMMA]]).
- The producer/consumer async pipeline assigns one warpgroup to TMA data loading (gmem→smem) and another to matmul+softmax, executing concurrently via async-transaction barriers.
- Inter-warpgroup overlap uses cutlass-style pingpong scheduling so two warpgroups alternate computing different output tiles of the same GEMM, keeping Tensor Core busy.
- Intra-warpgroup overlap pipelines softmax of iteration *k* with WGMMA of iteration *k+1*; since WGMMA peak throughput far exceeds CUDA core EXP throughput, the masking is partial (red blocks faster than orange blocks).
- On Hopper, register allocation for producer vs consumer warpgroups can be set independently — this is architecturally new vs Ampere, where register pressure was shared uniformly across all warps.
- [[WGMMA]] requires operand A in registers and B in shared memory for gemm1 (since gemm0's output lives in registers as operand C).

## Visual observations

*No load-bearing images — all panels text-only (typed content extracted into body).*

## What this changes

Establishes that achieving near-peak H100 performance on attention requires adopting Hopper-specific async ISA (TMA, WGMMA) — a template for any future attention variant targeting Hopper or [[Blackwell]].

## Entities touched

[[FlashAttention]], [[Hopper]], [[TMA]], [[WGMMA]]

## Topics touched

[[Attention Kernels]]

## Raw source

[mp.weixin.qq.com/s/cclvT7PxQzdkm9nYfWbhmQ](https://mp.weixin.qq.com/s/cclvT7PxQzdkm9nYfWbhmQ) — WeChat public account "AI不止算法", published 2025-04-09. Read 2026-05-16.
