---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 4
tier: active
---

# Per-Layer Embeddings

Gemma-4 design: packed per-layer embedding tensor gated by post-FFN hidden state and added as extra residual update; adds capacity without widening transformer stack

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Per-Layer Embeddings (PLE) are a [[Gemma 4]] E2B/E4B design choice for parameter efficiency: a packed PLE tensor with one small vector per decoder layer, built from (a) a per-layer embedding lookup of token IDs and (b) a linear projection of the normal token embeddings into the same packed space, added and scaled. — [[2026-05-17-recent-developments-in-llm-architectures]]
- In each transformer block, after attention + FFN residual updates produce hidden state z, z gates the layer-specific PLE vector; the gated vector is projected back to model hidden size, normalized, and added as an extra residual update. PLE keeps expensive transformer blocks at the "effective" size while storing extra capacity in cheap lookup-style embedding tables (E2B: 2.3B effective / 5.1B with PLE; E4B: 4.5B / 8B). — [[2026-05-17-recent-developments-in-llm-architectures]]
