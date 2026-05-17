---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 9
tier: active
---

# Gemma 4

Google open-weight LLM suite (Apr 2026): E2B/E4B small variants with cross-layer KV sharing + per-layer embeddings, 26B MoE, 31B dense

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Gemma 4 (Apr 2026 Google release) ships three categories: E2B/E4B mobile variants (35 and 42 layers respectively), a 26B MoE for efficient local inference, and a 31B dense model. The "E" in E2B/E4B stands for "effective" — main transformer-stack compute matches the smaller number while per-layer embedding tables push total parameter count higher (E2B: 2.3B effective / 5.1B total; E4B: 4.5B / 8B). — [[2026-05-17-recent-developments-in-llm-architectures]]
- Gemma 4 E2B uses [[GQA]] (specifically MQA, the one-KV-head case) plus [[Sliding Window Attention]] in a 4:1 sliding-to-full pattern, AND adds [[Cross-Layer Attention]]-style KV sharing where later layers reuse K/V from earlier non-shared layers of the same attention type. In E2B only the first 15 of 35 layers compute own KV; the final 20 reuse. Cache savings: ~2.7 GB (E2B) / ~6 GB (E4B) at bfloat16 in 128K context. — [[2026-05-17-recent-developments-in-llm-architectures]]
- Gemma 4 E2B/E4B also include [[Per-Layer Embeddings]] (PLE) — a packed embedding tensor with one slice per decoder layer that gets gated by the post-FFN hidden state and added as an extra residual update at the end of each block. — [[2026-05-17-recent-developments-in-llm-architectures]]
