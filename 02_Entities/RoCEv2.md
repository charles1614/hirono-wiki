---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 4
tier: active
---

# RoCEv2

RDMA over Converged Ethernet v2 — lossless Ethernet transport for distributed AI training

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Meta在SIGCOMM 2024论文中描述了基于[[RoCEv2]]构建大规模AI训练集群的演进：拓扑为单平面Spine-Leaf（RTSW/CTSW/ATSW），路由从ECMP→E-ECMP（UDF打散RoCE目标QP，AllReduce +40%）→集中式TE（CSPF算法）；传输层放弃DCQCN（400G固件Bug），改用集合通信库层CTS接收端准入控制，最终带宽收敛比降至1:1.125。 — [[2025-05-27-meta基于rocev2构建的大规模ai网络]]
