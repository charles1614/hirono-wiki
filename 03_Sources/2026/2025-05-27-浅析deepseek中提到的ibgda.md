---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/26082845081
tags: [gpu-networking, distributed-systems, source-shape/blog, gpu-programming]
---

# [2025-02-25] 浅析DeepSeek中提到的IBGDA

## TL;DR

A bottom-up explainer of [[IBGDA]] (InfiniBand GPUDirect Async) — the NVIDIA technology cited in the [[DeepSeek-V3]] technical report for low-latency collective communication — covering kernel protocol stack limitations, RDMA fundamentals (InfiniBand/RoCE, QP/WQE/CQ model), and how IBGDA eliminates the CPU proxy thread from the GPU→NIC communication path.

## Key claims

- Traditional CPU proxy thread communication requires 10 steps and 3 parties (GPU/CPU/NIC): GPU kernel writes to proxy buffer → CPU proxy reads and posts doorbell → NIC DMA pulls GPU data and sends. CPU bottlenecks fine-grained small-message transfers; modern NICs handle hundreds of millions of requests/sec but CPU cannot match that rate.
- [[IBGDA]] removes CPU from the control path: GPU SM directly writes work descriptors (WQE) and doorbell records (DBR) — both located in GPU memory — then writes NIC doorbell register; NIC uses GPUDirect RDMA to read WQ from GPU memory and DMA data directly.
- RDMA conceptual model: Send Queue (SQ) + Receive Queue (RQ) + Completion Queue (CQ) exposed to user space; Queue Pair Context (QPC) lives on RNIC hardware so hardware can assemble packet headers and maintain connection state without kernel involvement.
- RDMA verbs taxonomy: Send/Recv (two-sided, both CPUs involved), Read (one-sided initiator reads remote memory), Write (one-sided initiator writes remote memory — remote CPU unaware). InfiniBand requires lossless network (hardware flow control at link layer).
- [[NVSHMEM]] wraps IBGDA capability and provides a symmetric global address space across all GPU participants; [[DeepEP]] (DeepSeek's MoE communication library) uses NVSHMEM for low-latency expert dispatch.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[IBGDA]], [[DeepSeek-V3]], [[NVSHMEM]], [[DeepEP]], [[NCCL]]

## Topics touched

[[GPU Cluster Networking]], [[Expert Parallelism]], [[GPU Programming Models]]

## Raw source

[zhuanlan.zhihu.com/p/26082845081](https://zhuanlan.zhihu.com/p/26082845081) — Zhihu article, author: 老生物楼里的家兔, published 2025-02-25. Read 2026-05-16.
