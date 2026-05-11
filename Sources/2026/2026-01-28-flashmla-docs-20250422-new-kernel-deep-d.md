---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/deepseek-ai/FlashMLA/blob/main/docs/20250422-new-kernel-deep-dive.md
tags: [flashmla, mla, deepseek, flash-attention, hopper, h800, wgmma, tma, kernel-design, decoding]
---

# [2026-01-28] FlashMLA — A Deep-Dive Into the New Flash MLA Kernel

## TL;DR

DeepSeek-AI's deep-dive into the **new FlashMLA decoding kernel** (April 22 2025). Previous kernel: 3,000 GB/s memory-bound, 580 TFlops compute-bound. **New kernel reaches 660 TFlops** (~80% of throttled H800's ~865 TFlops practical peak). Key insight: **MLA decoding is compute-bound**, not memory-bound — because DeepSeek's inference doesn't use tensor parallelism, `h_q × s_q ≥ 128`, putting the compute-memory ratio above H800's `865/3.35 ≈ 258` crossover. The kernel can't use FlashAttention-3's ping-pong scheduling because the 64×512 output matrix needs 32,768 registers (half the SM's 65,536 register file) — one output per SM, no two-buffer rotation. Solution: a novel **"seesaw" schedule** that splits the output vertically (O_L / O_R) across two warpgroups operating on alternating KV blocks, achieving CUDA-Core + Tensor-Core overlap *with only one output matrix*. Includes the full 12-step seesaw algorithm.

## Key claims

- **MLA decoding is compute-bound on H800** (surprising for an attention kernel — usually memory-bound). The math:
  - FLOPs ≈ `2 · h_q · s_q · s_k · (d_k + d_v)`
  - Memory ≈ `2 · s_k · d_k` (assuming `s_k >> h_q · s_q`)
  - Ratio ≈ `h_q · s_q · (d_k + d_v) / d_k ≈ 2 · h_q · s_q`
  - **Crossover on H800 SXM5**: 990 TFLOPS peak / 3.35 TB/s = 295. **Throttled** to ~865 TFLOPS / 3.35 TB/s = **258**. Compute-bound when `h_q · s_q ≥ 128`.
  - DeepSeek doesn't TP the decoding instances, so `h_q = 128` (or 64 with s_q=2 etc) → always compute-bound.
- **Why FlashAttention-3's ping-pong doesn't apply**:
  - FA-3 uses ping-pong with two output matrices interleaved between warpgroups for CUDA-Core/Tensor-Core overlap.
  - **WGMMA instruction requirement**: output matrix must live in registers.
  - **64×512 output @ 32-bit = 32,768 registers** = half of the 65,536-register SM file.
  - **Only one output per SM is possible** → can't do FA-3's two-buffer rotation.
- **The "seesaw" schedule** (load-bearing innovation):
  - Vertical-split the output: O_L and O_R, each 64×256.
  - Same split on V: `V_0L`, `V_0R`, `V_1L`, `V_1R`.
  - Two warpgroups alternate between the K blocks `K_0` and `K_1`.
  - Each step interleaves work between the two warpgroups so CUDA-Core (softmax + scale) and Tensor-Core (GEMM) overlap, *and* TMA copies of new KV data can start as soon as the previous block is consumed.
  - **Mathematically equivalent to FlashAttention's online softmax** — same correctness, different schedule.
- **The 12-step algorithm** (paraphrased — `[0]`/`[1]` indicates warpgroup):
  1. `[0]` Compute `p_0 = q · K_0ᵀ / qk_scale`
  2. `[1]` Compute `p_1 = q · K_1ᵀ / qk_scale`
  3. `[0]` Update running max + scale_0
  4. `[0]` Softmax on p_0
  5. `[0]` Update O_L with scale_0 * O_L + p_0 · V_0L
  6. `[1]` Update running max + scale_1
  7. `[1]` Softmax on p_1
  8. `[1]` Update O_R with (scale_0 · scale_1) · O_R + p_1 · V_1R
  9. `[0]` Scale p_0 by scale_1
  10. `[1]` Update O_R += p_0 · V_0R
  11. `[0]` Update O_L = scale_1 · O_L + p_1 · V_1L
- **Technical details for memory-latency hiding** (kernel is compute-bound, but can't ignore latency):
  - **Fine-grained TMA-GEMM pipelining**: 64×576 K-block split into **nine 64×64 TMA copies**. GEMMs start as soon as the first copy completes. Then second copy → second GEMM, etc.
  - **`CacheHintSm90::EVICT_FIRST`** TMA hint — improves L2 hit rates per experiment.
  - **Programmatic Dependent Launch** to overlap `splitkv_mla` and `combine` kernels.
  - **Tile Scheduler** for balanced SM-level job allocation.
- **Achieved performance**:
  - **Up to 80% Tensor Core utilization** (of the throttled theoretical peak).
  - **3 TB/s memory bandwidth** on H800 SXM5.
  - **~2% slower** than the old ping-pong variant in pure memory-bound settings (acceptable trade for the compute-bound gain).
- **Acknowledgements** name FlashAttention, Flash-Decoding, CUTLASS as inspirations.

## Visual observations

**MLA Kernel Schedule — the seesaw 12-step timeline** (load-bearing — the algorithm IS this diagram)

![FlashMLA kernel schedule: two warpgroups operating on alternating KV blocks K0/K1 with the vertically-split output O_L/O_R, TMA copies interleaved with WGMMA compute, full 12-step seesaw schedule visualized as a timeline](../../raw/raindrop/github.com/2026-01-28-flashmla-docs-20250422-new-kernel-deep-d/github-img-001.svg)

The 12-step seesaw schedule from the Key Claims section, rendered on a real timeline showing where each warpgroup's compute lives, where TMA copies are launched, and how the output halves O_L/O_R rotate. Implementing this kernel without this diagram open is impractical — the textual algorithm describes *what* each step does but not the temporal interleaving that makes the CUDA-Core / Tensor-Core overlap work.

## What this changes

- **For attention-kernel authors**: the register-budget constraint that forces away from FA-3's ping-pong design is a generalizable lesson. Not every WGMMA-based kernel can use the same scheduling primitives — register pressure forces alternative schedules. The seesaw pattern is now in the toolbox.
- **For DeepSeek + MLA users**: this kernel is the path to high decoding throughput for MoE+MLA architectures (DeepSeek-V3, V3.1, R1). Combined with high `h_q = 128`, the compute-bound regime means tensor-core utilization is the ceiling — and 80% is good but not 100%.
- **For TP=1 inference debates**: this paper is evidence that *not using TP* (so `h_q` stays at 128 in DeepSeek's case) reshapes the bottleneck from memory to compute. Some teams TP decode aggressively for KV bandwidth; DeepSeek's choice argues for high attention-head concurrency.
- **For other MLA implementations**: outside DeepSeek's stack, who's adopting MLA? FlashMLA's gains demonstrate MLA is now production-grade; expect more architectures to consider it. Pairs with [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] (NVIDIA paper specifically calls out MLA's piggyback chunking overhead and a cache-up-projection mitigation).

## Entities touched

[[FlashMLA]], [[DeepSeek]], [[MLA]], [[FlashAttention]], [[FlashAttention-3]], [[CUTLASS]], [[H800]], [[TMA]], [[WGMMA]], [[Tensor Core]], [[Hopper]]

## Topics touched

[[Attention Kernels]], [[GPU Kernel Scheduling]], [[Decoding Optimization]], [[MoE Serving]]

## Raw source

[github.com/deepseek-ai/FlashMLA/.../20250422-new-kernel-deep-dive.md](https://github.com/deepseek-ai/FlashMLA/blob/main/docs/20250422-new-kernel-deep-dive.md) — ~7 KB markdown, 1 SVG diagram, with the full algorithm + math. Authored by Jiashi Li, Shengyu Liu (DeepSeek-AI), April 22 2025. Read 2026-05-11.
