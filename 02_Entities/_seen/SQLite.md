---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 2
tier: seen
---

# SQLite

Row-oriented embedded database used as the baseline comparison in the DuckDB benchmark, showing 6×–56× slower performance on aggregation and time-range queries.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
- [[Tencent]]'s [[TencentDB Agent Memory]] uses SQLite + sqlite-vec as its default local backend, persisting L0 conversation, L1 atom, and intermediate JSONL summaries. Hybrid retrieval combines BM25 (jieba/en tokenizer) with vector search via sqlite-vec, fused by Reciprocal Rank Fusion. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
