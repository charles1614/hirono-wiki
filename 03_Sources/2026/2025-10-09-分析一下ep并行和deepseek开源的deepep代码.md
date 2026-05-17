---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/Y0WaCU8DNFvulk3rwo5Ycg
tags: [moe, parallelism, comm-overlap, gpu, inference]
---

# [2025-02-28] 分析一下EP并行和DeepSeek开源的DeepEP代码

## TL;DR

深度代码解析 [[DeepEP]] 的高吞吐和低时延 Kernel 实现，并详细讨论在 RoCE 网络上运行 [[DeepEP]] 面临的 incast、RC 兼容、多轨拓扑等挑战，以及 SGLang 目前绕开 AlltoAll 而使用 AllGather+AllReduce 的原因。

## Key claims

- 单个 DeepSeek-R1 专家参数量约 44 MB（dim=7168，inter_dim=2048），在单卡上串行加载多个专家会严重占满显存带宽；EP 并行通过将专家分散到多机并增大 batch（论文 256，开源代码 128）来提升吞吐。
- SGLang 当前 EP 实现用 AllGather + AllReduce 替代 AlltoAll（EPMoE 类），规避 RoCE 环境下 AlltoAll incast 引发的长尾延迟；但此方案通信量显著更大，DeepEP 整合正在进行中。
- [[DeepEP]] 高吞吐 Kernel（Internode::dispatch）使用 warp specialization 分工：kRDMASender、kRDMASenderCoordinator、kRDMAAndNVLForwarder、kForwarderCoordinator、kNVLReceivers 五类角色，协同完成 IB→NVLink 的跨节点转发。
- 低时延 Kernel 采用 LowLatency Layout，分 SEND PHASE 和 RECV PHASE；Combine 路径对应 kNVLSender、kNVLAndRDMAForwarder、kRDMAReceiver、kCoordinator 角色。
- DeepEP 中使用了文档外 PTX 指令和特殊 Memory Order 保证，并对 NVSHMEM 库进行了修改，这些是性能关键但可移植性有限的设计。
- RoCE 运行 DeepEP 面临四大挑战：Multi-Rail/Rail-Only 拓扑兼容性差、AlltoAll incast 问题、RC（Reliable Connection）模式适配、In-Network Computing 缺失；作者认为真正适合 EP 的方案需专为 Ethernet 设计的 RDMA 技术。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

- 揭示了 DeepEP 在 IB 之外扩展到 RoCE 存在实质性工程障碍，为社区评估在非 NVIDIA 网络上部署 EP 提供了清醒的技术参照。

## Entities touched

[[DeepEP]], [[SGLang]], [[Expert Parallelism]], [[MoE]], [[NVSHMEM]], [[NCCL]]

## Topics touched

[[MoE Serving]], [[MoE Training]], [[Expert Parallelism]], [[Communication-Computation Overlap]]

## Raw source

[mp.weixin.qq.com/s/Y0WaCU8DNFvulk3rwo5Ycg](https://mp.weixin.qq.com/s/Y0WaCU8DNFvulk3rwo5Ycg) — WeChat 公众号"GiantPandaLLM"，2025-02-28，HTML 转 Markdown。Read 2026-05-15.
