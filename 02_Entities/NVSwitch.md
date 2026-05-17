---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 5
tier: active
---

# NVSwitch

NVIDIA NVLink crossbar switch chip — connects multiple GPUs into a single NVLink fabric (NVL72 = 72 GPUs via NVSwitch trays)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- NCCL uses NVSwitch's NVLS (NVLink Sharp) for AllReduce on H100 by default, offloading the reduce operation to NVSwitch broadcast/reduce hardware; this achieves 480 GiB/s busbw vs 363 GiB/s ring-based, at lower per-GPU NVLink bandwidth consumption (100–130 vs 170–190 GiB/s). — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]
- nvidia-fabricmanager is required for NVSwitch/NVLS operation on H100; an OOM-kill of fabricmanager causes NCCL AllReduce to hang when NCCL defaults to NVLS algorithm; recovery requires fabricmanager restart (sometimes full node reboot). — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]
