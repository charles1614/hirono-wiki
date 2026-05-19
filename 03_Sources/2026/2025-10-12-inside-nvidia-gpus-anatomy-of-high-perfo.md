---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.aleksagordic.com/blog/matmul
tags: [inference, training, gpu]
---

# [2025-10-12] Inside NVIDIA GPUs: Anatomy of High-Performance Matmul Kernels

## TL;DR

[[Aleksa Gordić]]'s deep-dive blog series: Part 1 covers H100 GPU architecture and CUDA programming model fundamentals as prerequisites for understanding near-SOTA synchronous and SOTA asynchronous matmul kernels. The post is self-contained and proceeds from memory hierarchy to tensor core pipelines, targeting practitioners who want to write high-performance GPU kernels.

## Key claims

- [[H100]] (SXM5) has 132 SMs, each with 4 warp schedulers capable of issuing 128 threads in true parallel per cycle; up to 2048 concurrent threads per SM managed via latency-hiding.
- Memory hierarchy (fastest to slowest): register file (RMEM, same total size as L1+SMEM) → L1/SMEM (configurable split, programmer-managed SMEM) → L2 (two physical partitions, each connected to half the SMs) → HBM (off-chip DRAM via stacked HBM).
- Tensor Memory Accelerator (TMA) introduced in [[Hopper]]: async transfers between global memory and shared memory (and between cluster SMs), plus swizzling to reduce bank conflicts.
- "Speed of light" (SoL) peak throughput = `freq_clk_max × num_tc × flop_per_tc_per_clk`; power throttling lowers effective clock and thus reduces SoL — BF16 SoL is a function of actual clock, not a fixed spec.
- Thread block should contain ≥4 warps (128 threads) to keep all 4 warp schedulers per SM busy; thread block clusters (CUDA Hopper feature) group up to 8 SMs for distributed shared memory (DSMEM) access via TMA.
- CUDA hierarchy: thread → warp (32) → thread block → cluster → grid; positional variables (`gridDim`, `blockIdx`, `blockDim`, `threadIdx`) live in special registers initialized at kernel launch.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/www.aleksagordic.com/2025-10-12-inside-nvidia-gpus-anatomy-of-high-perfo/aleksagordic-img-001.png)
![](https://hirono-wiki.litenext.digital/raindrop/www.aleksagordic.com/2025-10-12-inside-nvidia-gpus-anatomy-of-high-perfo/aleksagordic-img-002.png)
![](https://hirono-wiki.litenext.digital/raindrop/www.aleksagordic.com/2025-10-12-inside-nvidia-gpus-anatomy-of-high-perfo/aleksagordic-img-005.png)

*Other images decorative — diagrams and derivations summarized in claims.*

## Entities touched

[[Aleksa Gordić]], [[H100]], [[Hopper]], [[CUDA]]

## Topics touched

[[GPU Microarchitecture]], [[Tensor Core Programming]], [[Kernel Authoring]], [[GPU Memory Management]]

## Raw source

[aleksagordic.com/blog/matmul](https://www.aleksagordic.com/blog/matmul) — blog post by Aleksa Gordić. Read 2026-05-15.
