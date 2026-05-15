---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# OLMo

Allen AI's OLMo 2/3 open-weights dense models (7B/32B) included in Raschka's gallery as reference entries.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- OLMo 2 introduced Post-Norm (RMSNorm placed after, not before, attention + FFN) and QK-Norm together, demonstrating improved training-loss stability vs Pre-Norm (GPT-2/Llama style). The two techniques are combined and hard to disentangle from their joint ablation figure, but OLMo 3 retained Post-Norm in both its 7B and 32B variants. OLMo 3 7B adds sliding window attention on top of MHA (inherited from OLMo 2) while the 32B switches to GQA. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Datawhale/Raschka survey (Jul 2025): OLMo 2 uses Post-Norm + QK-Norm + MHA (not GQA); compared to Llama 3, architecturally similar except for Post-Norm placement and MHA vs GQA. Training stability was the primary motivation for Post-Norm adoption. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
