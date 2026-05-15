---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 0
tier: seen
---

# Daft

Distributed dataframe and multimodal data processing library built in Rust with Python bindings

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- The Ray Runner (Flotilla) extends Daft's streaming execution engine (Swordfish) to multi-node [[Ray]] clusters; uses one long-lived `RaySwordfishActor` per node (not per CPU), a Rust-based `DistributedPhysicalPlanRunner` for zero-GIL task scheduling, and checkpoint-free fault tolerance via immutable ObjectRefs with deterministic task replay; overhead makes it unsuitable for small datasets where the Native Runner is preferred. — [[2026-02-02-deepwiki-daft-06-ray-runner]]
