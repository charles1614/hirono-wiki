---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 1
---

# Checkpoint Resharding

## What

techniques for resharding distributed checkpoints across different parallelism configurations in LFM training

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Observations

- ByteCheckpoint (ByteDance, NSDI'25) defines three checkpoint resharding scenarios — training resumption (avg 1,870s offline), cross-stage transition (650s), evaluation (593s) — and eliminates all three via ShardMeta-based load-time resharding; production platform recorded 1,870 + 13,080 + 19,844 = 34,794 resharding events over six months. Irregular tensors (ZeRO-sharded, not n-dimensionally representable) are decomposed into multiple regular ShardMeta entries to avoid all-gather during save. — [[2025-03-06-2407-20143]]

## Open threads

- Will ShardMeta-style parallelism-agnostic checkpoint representation become the standard, or will framework-native approaches (DCP, MCP) converge on similar abstractions?

## Sources drawn on

- [[2025-03-06-2407-20143]] — ByteCheckpoint system design, production resharding statistics, ShardMeta representation, I/O optimization, NSDI'25 evaluation.
