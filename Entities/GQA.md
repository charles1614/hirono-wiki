---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# GQA

Group Query Attention; multi-head attention variant where K/V are shared across query heads (Llama2/3 style); cheaper KV cache than MHA, simpler than MLA.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Qwen3 GQA 参数量不对称：q_proj = hidden_size × (num_attention_heads × head_dim)；k_proj = v_proj = hidden_size × (num_key_value_heads × head_dim)；Qwen3 额外引入 q_norm 和 k_norm（各 head_dim 参数）对每个 head 做归一化，这在 Qwen2.5 中没有。 — [[2025-09-03-https-zhuanlan-zhihu-com-p-1901923837408]]
- Raschka's survey confirms GQA as the default K/V-sharing mechanism in Llama 3, Gemma 3/4, Qwen3, Mistral Small 3.1, GPT-OSS, and MiniMax M2. DeepSeek-V2 ablations cited in the survey show GQA slightly underperforms standard MHA in modeling quality, while MLA outperforms MHA — explaining DeepSeek's decision to use MLA instead of GQA. — [[2026-01-28-the-big-llm-architecture-comparison]]
- In [[Megatron-LM]]'s implementation, GQA sets `num_query_groups < num_attention_heads` (e.g., Llama-3 70B: 64 query heads, 8 KV heads — 8× KV cache reduction); query and KV heads shard independently across tensor-parallel ranks via `num_query_groups_per_partition` / `num_attention_heads_per_partition`. — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
- Datawhale/Raschka survey (Jul 2025): Llama 4 Maverick uses GQA (not MLA), adopting the simpler K/V-sharing variant despite DeepSeek V3 establishing MLA's quality advantage. OLMo 2 retains MHA (no GQA), while Mistral Small 3.1 and Qwen3 use GQA. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
