---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 8
tier: active
---

# Highly Compressed Attention

HCA attention variant introduced in DeepSeek V4-Pro alongside CSA as a hybrid replacement for MLA.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
- HCA is the heavier-compression half of [[DeepSeek-V4]]'s CSA/HCA hybrid: compresses every 128 tokens (m'=128) into one KV entry and uses dense attention over those heavily compressed entries — complementary to [[Compression Sparse Attention]] which keeps more detail but uses sparse selection. — [[2026-05-17-recent-developments-in-llm-architectures]]
