---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 11
tier: active
---

# NVSHMEM

NVIDIA's OpenSHMEM-based library for GPU-to-GPU communication, covered alongside NCCL in PMPP 5e's new Multi-GPU API chapter.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Used in [[DeepEP]] low-latency kernel for IBGDA (InfiniBand GPU Direct Async) single-sided RDMA; GPU directly issues RDMA via IB NIC without CPU involvement; IBGDA latency ~64 µs vs IBRC's 128–256 µs for <8 KiB All-to-All messages. — [[2025-10-09-xzwazsg-zjcksvuvksvw]]
- [[DeepEP]] internode dispatch uses `nvshmem_int_put_nbi` for non-blocking RDMA puts and `nvshmemi_ibgda_amo_nonfetch_add` for atomic token-count notification; IB Virtual Lanes isolate Normal kernel traffic from Low Latency kernel traffic (mixing VLs can cause deadlock or corruption with AR enabled). — [[2025-10-09-deepseek-deepep源码分析]]
- NVSHMEM IBRC mode uses a **single QP per PE pair** by design: AMO (atomic memory operation, `IBV_WR_ATOMIC_FETCH_AND_ADD`) serves as synchronization primitive and must arrive after all preceding RMA operations on the same QP — multiple QPs would break this ordering guarantee and cause data corruption; NVSHMEM actually builds ep_count QPs but uses only one (dead code for others). — [[2025-05-27-谈谈deepep中的nvshmem]]
- NVSHMEM wraps [[IBGDA]] capabilities and provides a symmetric global address space across all GPUs; [[DeepEP]] uses NVSHMEM for low-latency expert dispatch in MoE models. — [[2025-05-27-浅析deepseek中提到的ibgda]]
