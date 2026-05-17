---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# DTensor

PyTorch distributed tensor abstraction for SPMD sharding and parallelism

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DTensor 是 PyTorch SPMD 分片张量的官方标准抽象（device mesh 导向，面向设备网格轴的布局 `Replicate/Shard(i)/Partial`），已与 FSDP2、SimpleFSDP、AutoParallel、[[Torchtitan]] 集成；缺点：Python 实现带来 Eager 模式开销，动态形状支持不完善（issue pytorch/pytorch#159635）；通过 `torch.compile` 编译后可消除 Eager 开销。 — [[2025-09-04-torch-compile-训练的现状总结-2025年8月]]
