---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/MwoCtKVTC93eU42yR6NdrQ
tags: [inference, attention-kernels, gpu, minimal-impl]
---

# [2025-08-18] 不会 CUDA 也能轻松看懂的 FlashAttention 教程（算法原理篇）

## TL;DR

A pedagogical walkthrough of FlashAttention's algorithmic core, assuming minimal GPU programming background. The author derives a memory-efficient tiled Attention kernel step-by-step by fusing softmax into a single loop and eliminating O(SL²) intermediate tensors.

## Key claims

- Standard Attention materializes `s` and `p` matrices of shape `[SL, SL]` to HBM — their read/write cost dominates latency because SL >> D (head dim). — the key bottleneck FlashAttention solves.
- [[Kernel Fusion]] approach: by writing a single GPU kernel instead of separate operators, intermediate variables stay in SRAM and never touch HBM.
- Data tiling strategy: since each query's computation is independent, one parallel unit handles one query; K/V are streamed in a loop of length SL so SRAM footprint stays O(D).
- Key algorithmic insight: softmax division does not affect the QK·V multiplication order — so one can compute `numerator[i] = exp(s[i])` inline, accumulate the denominator while looping over K, and divide `O` by denominator only after the loop completes. This eliminates the length-SL `numerator` and `p` buffers.
- Explains GPU programming model in terms of: SRAM/HBM hierarchy, operator fusion, parallel unit decomposition, and the independence property of different query computations.

## Visual observations

*No load-bearing images — all panels text-only (typed content extracted into body).*

## What this changes

Provides the minimal conceptual path to understanding [[FlashAttention]] without CUDA expertise; useful as an entry point for practitioners before reading the original paper or Triton implementation.

## Entities touched

[[FlashAttention]], [[CUDA]]

## Topics touched

[[Attention Kernels]], [[Kernel Fusion]], [[GPU Programming Models]]

## Raw source

[mp.weixin.qq.com/s/MwoCtKVTC93eU42yR6NdrQ](https://mp.weixin.qq.com/s/MwoCtKVTC93eU42yR6NdrQ) — WeChat public article by 天才程序员周弈帆, published 2025-08-18. Read 2026-05-15.
