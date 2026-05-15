---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://jax-ml.github.io/scaling-book/gpus/
tags: [inference, gpu, accelerator-design]
---

# [2025-12-11] How to Think About GPUs — JAX Scaling Book Ch. 12

## TL;DR

Google JAX team's chapter-length deep dive into NVIDIA GPU microarchitecture, memory hierarchy, and networking for ML workloads, comparing GPU components 1:1 against TPU counterparts and providing roofline analysis for H100 and B200.

## Key claims

- GPU SM (Streaming Multiprocessor) maps to TPU Tensor Core; each SM contains 4 subpartitions each with a Tensor Core (matrix multiplication), Warp Scheduler (SIMD vector unit), 16k 32-bit registers, and 256kB SMEM (L1 cache). H100 has 132 SMs; B200 has 148 SMs.
- H100 peak compute: 990 bf16 TC TFLOPs/s vs. only 66 TFLOPs/s from CUDA cores — Tensor Cores account for ~15x more FLOPs/s than vector units. B200 TC grows to ~2048 FLOPs/cycle (vs. H100's ~1024), requiring TMEM (Tensor Memory) added in Blackwell because accumulator no longer fits in SMEM.
- Memory hierarchy per SM (H100/B200): 256kB registers, 256kB SMEM, then shared 50MB L2 (~5.5 TB/s measured, full-duplex), then HBM (3.35 TB/s for H100; 9 TB/s for B200; capacity 80GB → 192GB from H100 → B200).
- Critical intensity (peak FLOPs/HBM bandwidth): H100 fp16 = 990e12 / 3.35e12 ≈ 295; B200 = 2250e12 / 8e12 ≈ 281 — need batch size ~280 tokens to be compute-bound. fp8 doubles intensity to ~560.
- GPU vs. TPU modularity: H100 has 528 independent SIMD units (16k ALUs), TPU v5p has 8 VPU slots. GPU's granularity makes it more flexible but harder to achieve roofline; TPUs achieve closer to peak with a better compiler.
- NVLink networking: within a node (8 GPUs for H100, 72 for GB200), all-to-all full-bandwidth NVLink; H100 node has 450 GB/s per GPU full-duplex, B200 doubles to 900 GB/s. Beyond the node: InfiniBand fat-tree provides full bisection bandwidth (400 GB/s/GPU); DGX SuperPod reference architecture connects 1024 H100s across 128 nodes, 32 leaf + 16 spine IB switches.
- CUDA uses SIMT (Single Instruction Multiple Threads) vs. TPU's SIMD — each CUDA core has its own instruction pointer enabling branch divergence at the cost of silently degrading performance when warps diverge.
- TPU VMEM (128MB, ~40 TB/s) substantially larger and faster than GPU SMEM; GPU L2 is ~5.5 TB/s but shared and not programmer-controlled ("spooky action at a distance").

## Visual observations

![](../../raw/raindrop/jax-ml.github.io/2025-12-11-how-to-think-about-gpus-how-to-scale-you/default-img-001.png)
![](../../raw/raindrop/jax-ml.github.io/2025-12-11-how-to-think-about-gpus-how-to-scale-you/default-img-006.png)
![](../../raw/raindrop/jax-ml.github.io/2025-12-11-how-to-think-about-gpus-how-to-scale-you/default-img-004.png)

*Other images redundant with tables and body text.*

## What this changes

Provides a dense, first-principles GPU spec reference with exact numbers and GPU-TPU comparison tables; the roofline intensity analysis (batch ~280 for compute-bound H100) is directly actionable for inference serving decisions.

## Entities touched

[[H100]], [[B200]], [[NVLink]], [[InfiniBand]]

## Topics touched

[[GPU Microarchitecture]], [[GPU Cluster Networking]], [[GPU Memory Management]]

## Raw source

[jax-ml.github.io/scaling-book/gpus/](https://jax-ml.github.io/scaling-book/gpus/) — JAX Scaling Book, Google JAX team, Chapter 12. Last validated Jan 5, 2026. Read 2026-05-15.
