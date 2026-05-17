---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 3
tier: active
---

# Dynamo

PyTorch's CPython-bytecode-level graph capture frontend underlying torch.compile; the layer responsible for converting Python code into FX graphs

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Dynamo's ad-hoc CPython support has produced fragmented graph breaks hard for LLM coding agents to fix. The May 2026 refactor to mirror CPython's `tp_*` slot semantics lifts CPython test pass rates from **38% → 45%** and proactively eliminates classes of graph breaks in frontier models. Problem categories identified: CPython language gaps (e.g. `functools.partial` callable but not hashable in Dynamo), insufficient exception messages, and others. — [[2026-05-12-pytorch-devlog]]
- `torch._dynamo.config.nested_graph_breaks = True` enabled on ~250 Dynamo+Inductor test files; OSS benchmark sweep 81/82 passing (single regression pre-existing unstable model); graph-break reductions up to **67%**; up to **15% runtime speedup (8% geomean)** in models with significant graph merging (GNNs, detection models). Dynamo tracing time neutral or improved. — [[2026-05-12-pytorch-devlog]]
- `torch._higher_order_ops.print` expanded into a toolkit covering forward activations and backward gradients without inducing graph breaks. — [[2026-05-12-pytorch-devlog]]
