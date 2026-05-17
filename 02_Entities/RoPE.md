---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 8
tier: active
---

# RoPE

Rotary Position Embedding, the dominant positional encoding scheme across most 2025-2026 gallery entries.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Raschka's survey confirms RoPE as the near-universal positional encoding across 2025–2026 frontier models (Llama, Qwen, DeepSeek, Gemma, Mistral), with notable exceptions and partial departures: SmolLM3 uses NoPE (no positional embedding) in every 4th layer; Kimi Linear uses NoPE in its MLA global-attention layers; MiniMax M2 applies partial RoPE (only the first `rotary_dim` channels of each head get rotary encoding, enabling length extrapolation); Gemma 4 uses p-RoPE (only 25% of frequency pairs get positional information). — [[2026-01-28-the-big-llm-architecture-comparison]]
- [[Megatron-LM]]'s RoPE implementation applies `q_rot = q * cos + rotate_half(q) * sin` and `k_rot = k * cos + rotate_half(k) * sin`; configured via `position_embedding_type='rope'`, `rotary_percent`, and `rotary_base` (10000 standard; 500K for long context). — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
- In a scratch [[Llama]] re-implementation, the RoPE rotation matrix at each position uses `theta = 10000 ** (-2*(i-1)/d_model)` and the rotation property `q_m @ k_n == q @ R[n-m] @ k` is directly verifiable via `assert torch.isclose(x_m @ x_n, x @ R[n-m] @ y)` — providing a concrete unit test for correctness. Applying RoPE *without* a causal mask causes full (non-causal) attention and apparent loss collapse to 0.16 by attending to future tokens. — [[2025-05-20-llama-from-scratch-or-how-to-implement-a]]
- RoPE与MLA低秩KV不兼容的根因：若对压缩后的k^C施加RoPE，则q·k的内积中包含位置相关的Rt-j矩阵，位于W^UQ和W^UK之间，无法因矩阵乘法满足结合律而被吸收；DeepSeek的解法是将RoPE限制在独立的64维子空间（MQA格式共享k^R），完整attention = q^C·k^C + q^R·k^R，使主体KV仍可进行矩阵吸收压缩缓存。 — [[2025-06-05-deepseek技术解读-1-彻底理解mla-multi-head-latent]]
