---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/f7J6_tOtJFup1A1wlZhrPA
tags: [training, production-deployment]
---

# [2025-05-23] Meta基于RoCEv2构建的大规模AI网络

## TL;DR

解读Meta SIGCOMM 2024论文《RDMA over Ethernet for Distributed AI Training at Meta Scale》，介绍Meta如何在Grand Teton（H100）平台上基于[[RoCEv2]]构建大规模AI训练集群，覆盖拓扑、路由和传输层三大主题。

## Key claims

- 拓扑采用单平面Spine-Leaf架构（RTSW=Leaf、CTSW=Spine、ATSW跨AI Zone），节点内GPU通过NVSwitch全连接，GPU与NIC比例1:1，Leaf到GPU机架使用铜缆降低成本。
- 路由演进经历五个阶段：原始ECMP（哈希冲突严重）→ Path Pinning（作业碎片化时性能下降30%+）→ E-ECMP（利用UDF对RoCE目标QP字段额外打散，AllReduce性能提升40%）→ 集中式流量工程TE（CSPF算法+精确匹配表）→ Flowlet/Packet Spray。
- 集中式TE工作原理：拓扑收集器实时构建拓扑→TE引擎用流量矩阵计算最优路径→交换机编程器通过精确匹配表覆盖默认路由；局限性包括依赖准确拓扑信息、单点故障风险。
- 传输层：200G网络中PFC+DCQCN有效，但400G网卡固件DCQCN实现存在Bug，Meta放弃DCQCN转而在集合通信库层实现接收端驱动的准入控制（CTS消息），CTS数据包在交换机上使用高优先级队列。
- 优化路径整体总结：拓扑收敛比从1:1（极不稳定）→1:2（仍抖动）→开启TE（稳定但带宽利用率提升）→引入集合通信库流量管理（收敛比降至1:1.125）。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Meta]], [[RoCEv2]], [[NCCL]]

## Topics touched

[[GPU Cluster Networking]], [[Training Infrastructure]]

## Raw source

[mp.weixin.qq.com/s/f7J6_tOtJFup1A1wlZhrPA](https://mp.weixin.qq.com/s/f7J6_tOtJFup1A1wlZhrPA) — 微信公众号"高性能算力网络"，2025-05-23. Read 2026-05-16.
