---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 8
tier: active
---

# Compression Sparse Attention

CSA attention variant introduced in DeepSeek V4-Pro replacing MLA, paired with Highly Compressed Attention (HCA).

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
- In [[DeepSeek-V4]] CSA is the milder-compression half of the CSA/HCA hybrid: compression rate m=4 with a DeepSeek-Sparse-Attention-style sparse top-k selector. Compresses along the sequence dimension (groups of tokens → fewer KV entries) rather than per-token representation, a fundamental departure from [[MLA]]. Paired with [[Highly Compressed Attention]] in alternating layers and supplemented by a 128-token sliding-window branch for recent uncompressed tokens. — [[2026-05-17-recent-developments-in-llm-architectures]]
