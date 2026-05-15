---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 8
tier: active
---

# NCCL

NVIDIA Collective Communications Library — standard GPU-to-GPU collective primitive implementations (AllReduce, AllGather, ReduceScatter, etc.).

## Observations

- _(stub — populate as sources reference this entity. Reindex will count refs and may promote to active tier at ≥3.)_
- ByteDance's veRoCE protocol is positioned as an alternative transport layer beneath NCCL-level collectives: veRoCE fixes RoCEv2's PFC dependence and lack of multi-path support, enabling AlltoAll communication (used by NCCL for MoE expert dispatch) to achieve ~48.4% higher throughput in 128 GPU clusters. — [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]]
