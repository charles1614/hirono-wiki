---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# NVSHMEM

NVIDIA's OpenSHMEM-based library for GPU-to-GPU communication, covered alongside NCCL in PMPP 5e's new Multi-GPU API chapter.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Used in [[DeepEP]] low-latency kernel for IBGDA (InfiniBand GPU Direct Async) single-sided RDMA; GPU directly issues RDMA via IB NIC without CPU involvement; IBGDA latency ~64 µs vs IBRC's 128–256 µs for <8 KiB All-to-All messages. — [[2025-10-09-xzwazsg-zjcksvuvksvw]]
- [[DeepEP]] internode dispatch uses `nvshmem_int_put_nbi` for non-blocking RDMA puts and `nvshmemi_ibgda_amo_nonfetch_add` for atomic token-count notification; IB Virtual Lanes isolate Normal kernel traffic from Low Latency kernel traffic (mixing VLs can cause deadlock or corruption with AR enabled). — [[2025-10-09-deepseek-deepep源码分析]]
