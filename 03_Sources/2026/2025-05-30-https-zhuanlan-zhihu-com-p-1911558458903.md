---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/1911558458903335293?share_code=1dia1Vjfy9oja&utm_psn=1911885713353475130
tags: [training, parallelism]
---

# [2025-05-30] 重读 Google 旧文 Pathways，寻找 veRL 中 Single-controller 思想源头

## TL;DR

方佳瑞（字节跳动）重读 Google 2022 年 Pathways 论文，追溯 veRL 框架中 single-controller 设计的思想源头，并结合 oneflow 团队的深度注解分析 single-controller vs. multi-controller 的适用边界。

## Key claims

- Pathways（MLSys 2022）由 Google 发布，使用其训练了 540B PaLM；尾作 Yonghui Wu 现为字节 Seed 负责人；论文预印本与 PaLM 同步亮相。
- **Multi-controller**（SPMD/MPI 风格）：每个 rank 运行相同代码，适合 DP；对 MPMD 场景（pipeline parallel、MoE）力不从心，死锁风险由 NCCL 内部调度处理。
- **Single-controller**：一个 master 节点描述计算图，图节点为多卡 SPMD 程序；可实现单 Python 进程管理数万 TPU，且图各节点资源可动态调节；TensorFlow V1 早期曾用此思路，但被 PyTorch 以简洁 DP 打败。
- Pathways 真正未能预见的 MPMD 场景是 RLHF 多模型计算图（2022 年 3 月 InstructGPT 发布，年末 ChatGPT 才被广泛认识），而非 PP/MoE。
- [[Ray]] Actor = Pathways 中计算图节点的开源实现候选；但 Ray 的 object store 透明数据搬运在大规模 GPU 并行时存在隐患（缺乏 RDMA，大文件传输差强人意）。
- 作者总结三种选择：SPMD → multi-controller；MPMD 且调度开销敏感 → 微服务架构（PD 分离推理引擎、Nemo-Aligner）；MPMD 且调度开销可忽略 → single-controller（[[verl]]）。

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

Single-controller 在 RL 训练中的复兴（[[verl]]）可以直接追溯到 Pathways 的架构理念，而非独立发明；这为理解 veRL 的设计决策提供了历史背景。

## Entities touched

[[Pathways]], [[verl]], [[Ray]], [[NCCL]]

## Topics touched

[[Parallelism Strategies]], [[LLM Training Systems]]

## Raw source

[zhuanlan.zhihu.com/p/1911558458903335293](https://zhuanlan.zhihu.com/p/1911558458903335293?share_code=1dia1Vjfy9oja&utm_psn=1911885713353475130) — Zhihu 专栏，方佳瑞，2025-05-30，字节跳动. Read 2026-05-16.
