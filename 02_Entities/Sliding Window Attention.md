---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 5
tier: active
---

# Sliding Window Attention

Local attention mechanism used alongside global MHA and grouped GQA in DeepSeek V4's hybrid attention composition.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
- [[Gemma 4]] E2B uses sliding-window attention in a 4:1 mix with full attention. [[Laguna XS.2]] uses sliding window (window 512) for 30 of 40 layers, full for the remaining 10. [[DeepSeek-V4]] keeps a 128-token sliding-window branch as a "recent uncompressed tokens" path alongside its CSA/HCA compressed-attention layers. Sliding window appears across the 2026 cohort as the standard cheap "local context" complement to a more expensive global attention variant. — [[2026-05-17-recent-developments-in-llm-architectures]]
