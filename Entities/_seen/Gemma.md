---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Gemma

Google DeepMind's Gemma 3/4 model family (dense, 270M to 31B) included in Raschka's architecture gallery.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Gemma 3 (27B) uses sliding window attention at a 5:1 local:global ratio (1024-token window, down from Gemma 2's 4096) combined with Pre+Post-Norm RMSNorm placement around the attention block and QK-Norm. This reduces KV-cache memory substantially with minimal perplexity impact per ablations cited by Raschka. Gemma 4 (31B) is architecturally near-identical to Gemma 3 but adds key-reuse (values = keys) in global layers for further KV-cache reduction and partial RoPE (25% frequency pairs). — [[2026-01-28-the-big-llm-architecture-comparison]]
