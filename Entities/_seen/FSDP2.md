---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# FSDP2

Fully Sharded Data Parallel v2 — PyTorch-native rewrite using DTensor instead of FlatParameter

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- FSDP2 用 [[DTensor]] 取代 FSDP1 的不透明 `FlatParameter`（扁平化参数），是 FSDP1 的现代化重构；PyTorch 官方已弃用 FSDP1；FSDP2 在 SPMD 梯度累积中不直接使用 DTensor 操作（detach+add 成瓶颈），但整体生态集成更好，AutoParallel 和 SimpleFSDP 均以 FSDP2 为基础。 — [[2025-09-04-torch-compile-训练的现状总结-2025年8月]]
