---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 7
tier: active
---

# Cross-Layer Attention

KV-cache-reduction technique where later transformer layers reuse K/V projections from earlier non-shared layers of the same attention type

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Cross-Layer Attention reduces [[KV Cache]] size by having later transformer layers reuse K/V tensors from the most recent earlier non-shared layer of the same attention type (sliding-window or full). Layers still compute their own queries, so each layer can form its own attention pattern. Traces to Brandon *et al.*, "Reducing Transformer KV Cache Size with Cross-Layer Attention" (NeurIPS 2024). — [[2026-05-17-recent-developments-in-llm-architectures]]
- First popularized in [[Gemma 4]] E2B (15/35 layers compute own KV; remaining 20 share) and E4B (24/42 own; 18 share). Roughly halves KV cache size — ~2.7 GB savings for E2B at 128K bfloat16, ~6 GB for E4B. Tradeoff is reduced model capacity ("an approximation of the real thing"), but per the cross-layer attention paper the impact is minimal at the tested model sizes. — [[2026-05-17-recent-developments-in-llm-architectures]]
