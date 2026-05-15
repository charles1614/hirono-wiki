---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# GQA

Group Query Attention; multi-head attention variant where K/V are shared across query heads (Llama2/3 style); cheaper KV cache than MHA, simpler than MLA.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Raschka's survey confirms GQA as the default K/V-sharing mechanism in Llama 3, Gemma 3/4, Qwen3, Mistral Small 3.1, GPT-OSS, and MiniMax M2. DeepSeek-V2 ablations cited in the survey show GQA slightly underperforms standard MHA in modeling quality, while MLA outperforms MHA — explaining DeepSeek's decision to use MLA instead of GQA. — [[2026-01-28-the-big-llm-architecture-comparison]]
- In [[Megatron-LM]]'s implementation, GQA sets `num_query_groups < num_attention_heads` (e.g., Llama-3 70B: 64 query heads, 8 KV heads — 8× KV cache reduction); query and KV heads shard independently across tensor-parallel ranks via `num_query_groups_per_partition` / `num_attention_heads_per_partition`. — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
