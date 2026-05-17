---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# BytePS

Bytedance parameter server communication library for distributed DL training; base for StepMesh

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Chosen by 阶跃星辰 as the base for [[StepMesh]] over [[NCCL]] because BytePS's lighter architecture supports the bipartite graph communication pattern of AF disaggregation, which NCCL's collective-centric API does not natively accommodate. — [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]]
