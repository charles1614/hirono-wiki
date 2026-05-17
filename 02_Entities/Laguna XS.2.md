---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 7
tier: active
---

# Laguna XS.2

Poolside open-weight coding LLM (2026) with per-layer query-head budgeting across 30 sliding-window + 10 full-attention layers

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Laguna XS.2 (Poolside, 2026) is the first open-weight model from a European LLM company focused on coding applications. Architecture is 40 transformer layers — 30 [[Sliding Window Attention]] layers (window 512) and 10 global/full-attention layers — with mixed sliding/global pattern not unique (Gemma 4 also uses it). — [[2026-05-17-recent-developments-in-llm-architectures]]
- Laguna XS.2 introduces per-layer query-head budgeting via a `num_attention_heads_per_layer` setting in `config.json` — sliding-window layers get 8 query heads per KV head, full-attention layers get 6, KV heads fixed at 8 throughout. Concept traces to Apple OpenELM (2024). Also uses per-head attention-output gating similar to Qwen3-Next. — [[2026-05-17-recent-developments-in-llm-architectures]]
