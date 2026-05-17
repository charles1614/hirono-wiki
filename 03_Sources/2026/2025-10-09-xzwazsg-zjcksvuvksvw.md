---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/xZWaZsg_Z5j4cKsvUvksVw
tags: [inference, moe, comm-overlap]
---

# [2025-07-20] 浅谈对DeepEP Low Latency模式实现的理解

## TL;DR

First-person technical walkthrough of [[DeepEP]]'s low-latency CUDA kernel for MoE All-to-All communication in decode. Author (Leo Zh+) explains the two-phase dispatch/combine design, IBGDA's latency advantage over IBRC for <8 KiB messages, and two recv_hook modes for overlapping RDMA with compute.

## Key claims

- [[DeepEP]] low-latency mode uses NVSHMEM IBGDA (InfiniBand GPU Direct Async) for single-sided RDMA; at message sizes <8 KiB, IBGDA latency is consistently ~64 µs vs IBRC's 128–256 µs.
- Pre-allocated large receive buffers eliminate a metadata sync round-trip (no need to pre-exchange token counts per rank); each rank computes buffer offsets directly and writes without coordination.
- Dispatch kernel: token data send (FP8 quantization optional, reduces 16-bit tokens by 50%) uses topk=8 warps per SM; token count send via atomic add (`nvshmemi_ibgda_amo_nonfetch_add`) is gated on all token data completing — enforced by incrementing a per-expert atomic counter and busy-waiting.
- Recv phase: kernel waits on rdma_recv_count (sentinel: `-num_recv_tokens-1`) then reorders non-contiguous tokens into contiguous layout; `recv_range[rank]` and `recv_src_info` track position/count for the combine reduce.
- Two operation modes: `recv_hook=false` (single kernel, overlappable with compute) vs `recv_hook=true` (split send+recv kernels, each ~10 µs, SM resources released between phases for maximum GPU utilization).
- Three-stage mental model: LOW_LATENCY_SEND_PHASE (active) → RDMA in-flight (SM idle) → LOW_LATENCY_RECV_PHASE (active); combine mirrors dispatch in reverse using stored recv_range and src_idx for reduction.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-10-09-xzwazsg-zjcksvuvksvw/weixin-img-002.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-10-09-xzwazsg-zjcksvuvksvw/weixin-img-007.png)

*Other images decorative — data format diagrams and buffer layouts described in body.*

## Entities touched

[[DeepEP]], [[NVSHMEM]]

## Topics touched

[[Expert Parallelism]], [[Communication-Computation Overlap]], [[MoE Serving]], [[GPU Cluster Networking]]

## Raw source

[mp.weixin.qq.com/s/xZWaZsg_Z5j4cKsvUvksVw](https://mp.weixin.qq.com/s/xZWaZsg_Z5j4cKsvUvksVw) — Leo Zh+ WeChat article, published 2025-07-20. Read 2026-05-15.
