---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# GQA

Group Query Attention; multi-head attention variant where K/V are shared across query heads (Llama2/3 style); cheaper KV cache than MHA, simpler than MLA.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Raschka's survey confirms GQA as the default K/V-sharing mechanism in Llama 3, Gemma 3/4, Qwen3, Mistral Small 3.1, GPT-OSS, and MiniMax M2. DeepSeek-V2 ablations cited in the survey show GQA slightly underperforms standard MHA in modeling quality, while MLA outperforms MHA — explaining DeepSeek's decision to use MLA instead of GQA. — [[2026-01-28-the-big-llm-architecture-comparison]]
