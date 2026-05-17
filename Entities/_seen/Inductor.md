---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 1
tier: seen
---

# Inductor

PyTorch's backend code generator (Triton/C++) within torch.compile; consumes FX graphs from Dynamo and emits fused kernels

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Together with [[Dynamo]], Inductor unit tests now run with `nested_graph_breaks = True` across ~250 test files (May 2026). Stable enough that 81/82 OSS benchmark models pass and the default is being prepared. — [[2026-05-12-pytorch-devlog]]
