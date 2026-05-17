---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17T00:00:00.000Z
type: entity
refs: 15
tier: active
---

# GQA

Group Query Attention; multi-head attention variant where K/V are shared across query heads (Llama2/3 style); cheaper KV cache than MHA, simpler than MLA.

## Synthesis



Grouped-Query Attention is the default K/V-sharing mechanism in modern open-weight LLMs — adopted by Llama 3/4, Gemma 3/4, Qwen3, Mistral Small 3.1, GPT-OSS, and MiniMax M2 — implemented by setting `num_query_groups < num_attention_heads` so multiple query heads share a single KV head (e.g., Llama-3 70B uses 64 query heads with 8 KV heads for 8× KV cache reduction). Per DeepSeek-V2 ablations cited by Raschka, GQA slightly underperforms standard MHA in modeling quality while MLA outperforms MHA — explaining DeepSeek's decision to use MLA rather than GQA despite GQA's lower implementation complexity. gpt-oss applies GQA in an alternating pattern (full-context GQA every other layer, sliding-window-128 GQA between), with the 128-token window unusually small versus Gemma 2's 4096 and Gemma 3's 1024; Gemma ablations show minimal modeling impact from sliding window at 4096 (Gemma 2) and 1024 (Gemma 3) tokens. In Megatron-LM's implementation, query and KV heads shard independently across tensor-parallel ranks via `num_query_groups_per_partition` and `num_attention_heads_per_partition`, and Qwen3 additionally introduces q_norm and k_norm parameters per head (absent in Qwen2.5) that contribute to QK-Norm training stability.



## Observations

- Qwen3 GQA 参数量不对称：q_proj = hidden_size × (num_attention_heads × head_dim)；k_proj = v_proj = hidden_size × (num_key_value_heads × head_dim)；Qwen3 额外引入 q_norm 和 k_norm（各 head_dim 参数）对每个 head 做归一化，这在 Qwen2.5 中没有。 — [[2025-09-03-https-zhuanlan-zhihu-com-p-1901923837408]]
- Raschka's survey confirms GQA as the default K/V-sharing mechanism in Llama 3, Gemma 3/4, Qwen3, Mistral Small 3.1, GPT-OSS, and MiniMax M2. DeepSeek-V2 ablations cited in the survey show GQA slightly underperforms standard MHA in modeling quality, while MLA outperforms MHA — explaining DeepSeek's decision to use MLA instead of GQA. — [[2026-01-28-the-big-llm-architecture-comparison]]
- gpt-oss uses GQA in alternating pattern: full-context GQA every other layer, sliding-window-128 GQA in between; the 128-token window is unusually small vs Gemma 2's 4096 and Gemma 3's 1024; Gemma ablations show minimal modeling performance impact from sliding window at 4096 tokens (Gemma 2) and 1024 tokens (Gemma 3). — [[2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch]]
- In [[Megatron-LM]]'s implementation, GQA sets `num_query_groups < num_attention_heads` (e.g., Llama-3 70B: 64 query heads, 8 KV heads — 8× KV cache reduction); query and KV heads shard independently across tensor-parallel ranks via `num_query_groups_per_partition` / `num_attention_heads_per_partition`. — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
- Datawhale/Raschka survey (Jul 2025): Llama 4 Maverick uses GQA (not MLA), adopting the simpler K/V-sharing variant despite DeepSeek V3 establishing MLA's quality advantage. OLMo 2 retains MHA (no GQA), while Mistral Small 3.1 and Qwen3 use GQA. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- [[Gemma 4]] E2B uses MQA (one-KV-head GQA) + [[Sliding Window Attention]] in 4:1 pattern, layered on top of [[Cross-Layer Attention]] KV sharing. [[Laguna XS.2]] keeps KV heads fixed at 8 but varies query heads per layer (6 for full-attention layers, 8 for sliding-window) — per-layer query-head budgeting via `num_attention_heads_per_layer`. — [[2026-05-17-recent-developments-in-llm-architectures]]
