---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# Ray

open-source distributed computing framework; provides actor model + placement groups + object store; used for ML cluster orchestration

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Daft's Ray Runner (Flotilla) uses a one-actor-per-node model: each `RaySwordfishActor` runs the full Swordfish streaming engine locally; a Rust-based `DistributedPhysicalPlanRunner` on the head node handles task scheduling and shuffle coordination with no Python GIL contention; named actors (`get_if_exists=True`) enable reuse across queries in the same job, amortizing 1–5 second creation cost. — [[2026-02-02-deepwiki-daft-06-ray-runner]]
- slime uses Ray as its distributed orchestration backbone: placement groups partition all cluster GPUs into actor/critic/rollout segments with deterministic ordering; Ray actors manage lifecycle of both training processes (`RayTrainGroup`) and inference engines (`SGLangEngine`); the Ray object store transfers rollout data between subsystems via object references, avoiding serialization overhead and enabling zero-copy when processes share a node. `RayTrainGroup` allocates 0.4 GPUs per actor to enable co-scheduling with inference when colocated. — [[2026-02-28-deepwiki-slime-01-overview]]
