---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/daft?file=06-ray-runner
tags: [inference, tooling, parallelism]
---

# [2026-02-02] DeepWiki daft / 06-ray-runner

## TL;DR

Deep architecture documentation for Daft's distributed execution engine, the Ray Runner (codenamed Flotilla), which extends Daft's streaming Swordfish engine to multi-node Ray clusters. Covers the full component hierarchy (RayRunner → FlotillaRunner → RemoteFlotillaRunner → RaySwordfishActor), partition management, shuffle strategies, data locality, and fault tolerance.

## Key claims

- The Ray Runner uses a **one actor per node** model (not per CPU): one long-lived `RaySwordfishActor` per cluster node, each running the full Swordfish streaming engine locally, minimizing actor startup overhead across repeated queries. — architectural decision with performance rationale
- `RemoteFlotillaRunner` runs on the head node with `num_cpus=0` (control plane only, no compute reservation); the actual Rust-based `DistributedPhysicalPlanRunner` handles task scheduling, dependency management, and shuffle coordination, reducing Python GIL contention. — Rust scheduler for low-overhead task coordination
- Named actors (`get_if_exists=True`) enable actor reuse across multiple queries in the same [[Ray]] job, amortizing the 1–5 second actor creation cost. — reuse pattern for interactive workloads
- Data locality: [[Ray]] tracks which node(s) hold each ObjectRef and schedules tasks preferentially on nodes with the most input data; automatic spilling to disk when memory is full. — Ray object store as the data transfer layer
- Sort-based shuffle samples data first to determine partition boundaries (quantile computation via `get_boundaries_remote`), then range-partitions and routes data to workers. Hash-based shuffle uses `hash(key) % num_partitions`. — two shuffle strategies with implementation details
- Fault tolerance is checkpoint-free: all partitions are immutable ObjectRefs, failed tasks replay deterministically from the same inputs, fine-grained task granularity limits recomputation cost. — checkpoint-free design rationale
- Ray Runner overhead (actor creation, serialization, network transfer) makes it unsuitable for small datasets; Native Runner (Swordfish, single-process) is preferred for development and interactive analysis. — clear threshold guidance: use Ray Runner only when dataset exceeds single-machine memory or requires distributed GPU resources

## Visual observations

*3 mermaid architecture diagrams: overall Flotilla execution flow (Client→Head→Workers→Store), GroupBy shuffle stages (Map→Shuffle→Reduce), and per-worker Swordfish execution pipeline. All diagrams are structural — no load-bearing numbers.*

## Entities touched

[[Ray]], [[slime]]

## Topics touched

[[LLM Inference Systems]], [[Data Loading Pipelines]]

## Raw source

[wiki.litenext.digital/2026-02-02-deepwiki-daft-06-ray-runner](https://wiki.litenext.digital/wiki/daft?file=06-ray-runner) — DeepWiki auto-generated architecture doc, source commit `0fdb7eac`, generated 2026-01-30. Read 2026-05-15.
