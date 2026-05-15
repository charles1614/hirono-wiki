---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# RoPE

Rotary Position Embedding, the dominant positional encoding scheme across most 2025-2026 gallery entries.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Raschka's survey confirms RoPE as the near-universal positional encoding across 2025–2026 frontier models (Llama, Qwen, DeepSeek, Gemma, Mistral), with notable exceptions and partial departures: SmolLM3 uses NoPE (no positional embedding) in every 4th layer; Kimi Linear uses NoPE in its MLA global-attention layers; MiniMax M2 applies partial RoPE (only the first `rotary_dim` channels of each head get rotary encoding, enabling length extrapolation); Gemma 4 uses p-RoPE (only 25% of frequency pairs get positional information). — [[2026-01-28-the-big-llm-architecture-comparison]]
- [[Megatron-LM]]'s RoPE implementation applies `q_rot = q * cos + rotate_half(q) * sin` and `k_rot = k * cos + rotate_half(k) * sin`; configured via `position_embedding_type='rope'`, `rotary_percent`, and `rotary_base` (10000 standard; 500K for long context). — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
