---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Ray

open-source distributed computing framework; provides actor model + placement groups + object store; used for ML cluster orchestration

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- slime uses Ray as its distributed orchestration backbone: placement groups partition all cluster GPUs into actor/critic/rollout segments with deterministic ordering; Ray actors manage lifecycle of both training processes (`RayTrainGroup`) and inference engines (`SGLangEngine`); the Ray object store transfers rollout data between subsystems via object references, avoiding serialization overhead and enabling zero-copy when processes share a node. `RayTrainGroup` allocates 0.4 GPUs per actor to enable co-scheduling with inference when colocated. — [[2026-02-28-deepwiki-slime-01-overview]]
