---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://d0a901er7io.feishu.cn/wiki/RMTLwJwfgic9orkzXX5cg00GnKc?fromScene=spaceOverview
tags: [distributed-training, model-architecture, systems]
---

# [2025-07-05] LLM Distributed Training: Communication Pattern Modeling (Feishu)

## TL;DR

A Feishu wiki page cataloging collective communication operations and their mapping to training parallelism strategies (TP, DP, EP, PP), with per-layer forward/backward communication assignments for transformer layer types.

## Key claims

- Six collective primitives covered: `All_Reduce`, `All_Gather`, `Reduce_Scatter`, `All_to_All`, `All_Reduce_All_to_All`, and `All_Reduce_NVLS` (NVLS-optimized for high-bandwidth AllReduce).
- Tensor Parallelism uses allreduce/allgather/reducescatter/alltoall; Data Parallelism uses allreduce/allgather/reducescatter; Expert Parallelism uses allgather/reducescatter/alltoall; Pipeline Parallelism uses send/recv.
- Per-layer forward/backward communication: embedding layer uses TP AllReduce forward; attention column uses AllGather forward + ReduceScatter backward; attention row reverses; MoE layer uses AllGather+AllToAll in both directions with TP+EP.
- Gradient aggregation uses DP AllGather (grad_gather backward) and ReduceScatter (grad_param_comm backward); MoE gradient norm uses AllGather/ReduceScatter across DP+EP.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Expert Parallelism]], [[MoE]]

## Topics touched

[[Parallelism Strategies]], [[Tensor Parallelism]], [[Expert Parallelism]], [[LLM Training Systems]]

## Raw source

[d0a901er7io.feishu.cn/wiki/RMTLwJwfgic9orkzXX5cg00GnKc](https://d0a901er7io.feishu.cn/wiki/RMTLwJwfgic9orkzXX5cg00GnKc?fromScene=spaceOverview) — Feishu wiki, author unknown, 2025. Read 2026-05-16.
