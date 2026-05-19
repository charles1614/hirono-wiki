---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/bLY4yPpyZRxz6ANzfWFG3Q
tags: [inference, moe, comm-overlap]
---

# [2025-03-06] DeepSeek DeepEP源码分析

## TL;DR

A Chinese-language source-code walkthrough of [[DeepEP]] from DeepPrompting. Explains the library's three communication modes (intranode NVLink, internode RDMA, low-latency RDMA with AR), the dispatch/combine All-to-All structure, NVSHMEM usage for cross-node messaging, and NVLink-based peer memory access for intranode transfers.

## Key claims

- [[DeepEP]] implements MoE expert-parallelism All-to-All in three modes: high-throughput intranode (NVLink), high-throughput internode (RDMA via NVSHMEM, no AR), and low-latency internode (RDMA with Adaptive Routing support).
- Intranode transfers use NVLink peer memory access — XBAR bridges enable GPU SMs to directly read/write another GPU's HBM via virtual addressing (`ld/st/atom/red/multimem`) without `cudaMallocManaged` or `cudaDeviceEnablePeerAccess`; memory is allocated via PyTorch's symmetric mem API.
- Internode dispatch uses `nvshmem_int_put_nbi` for non-blocking RDMA puts; buffers split into NVL Chunk and IB Chunk; tensor allocation via PyTorch ATen API.
- InfiniBand features used: Virtual Lanes (VL) for traffic isolation between Normal kernel, Low Latency kernel, and other workloads; Adaptive Routing for low-latency kernel only (Normal kernel + AR can cause deadlock/corruption); congestion control disabled (no observed congestion in production).
- Performance-critical PTX usage: `ld.global.nc.L1::no_allocate.L2::256B` — reads volatile data via non-coherent cache; works correctly on [[Hopper]] because nc and L1 are unified (no dirty L1 lines possible); guarded by `DISABLE_AGGRESSIVE_PTX_INSTRS=1` flag for portability.
- Design tradeoff: current implementation uses queue-based communication buffers (saves memory, adds complexity and deadlock risk); alternative is fixed max-capacity buffers (simpler, potentially faster, referenced in issue #39).

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-09-deepseek-deepep源码分析/weixin-img-001.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-09-deepseek-deepep源码分析/weixin-img-009.png)

*Other images decorative — buffer diagrams and Nsight traces described in body.*

## Entities touched

[[DeepEP]], [[NVSHMEM]], [[Hopper]], [[DeepSeek]]

## Topics touched

[[Expert Parallelism]], [[Communication-Computation Overlap]], [[GPU Cluster Networking]], [[MoE Serving]]

## Raw source

[mp.weixin.qq.com/s/bLY4yPpyZRxz6ANzfWFG3Q](https://mp.weixin.qq.com/s/bLY4yPpyZRxz6ANzfWFG3Q) — DeepPrompting WeChat article, published 2025-03-06. Read 2026-05-15.
