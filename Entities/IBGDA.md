---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 5
tier: active
---

# IBGDA

In-Band GPU Direct RDMA: NVIDIA technology for GPU-initiated RDMA communication bypassing CPU, used in DeepSeek V3 for low-latency collective ops

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- IBGDA (InfiniBand GPUDirect Async) removes CPU from GPU↔NIC communication path: GPU SM directly writes WQE + DBR (both in GPU memory) and NIC doorbell register; NIC uses GPUDirect RDMA to read WQ and DMA GPU data — eliminating CPU proxy thread bottleneck at fine-grained (small message) transfer rates. [[DeepSeek-V3]] technical report cites IBGDA for reducing collective communication latency. — [[2025-05-27-浅析deepseek中提到的ibgda]]
- Prior CPU-proxy path required 10 steps: GPU kernel → proxy buffer write → CPU proxy reads WQE → CPU writes DBR → CPU writes NIC doorbell → NIC DMA from GPU → transmit → NIC writes CQE → CPU polls CQ → CPU notifies GPU. IBGDA collapses steps 2–5 to direct SM writes. [[NVSHMEM]] exposes IBGDA capability with a symmetric global address space; [[DeepEP]] uses it for low-latency expert dispatch. — [[2025-05-27-谈谈deepep中的nvshmem]]
