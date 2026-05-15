---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# OLMo

Allen AI's OLMo 2/3 open-weights dense models (7B/32B) included in Raschka's gallery as reference entries.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- OLMo 2 introduced Post-Norm (RMSNorm placed after, not before, attention + FFN) and QK-Norm together, demonstrating improved training-loss stability vs Pre-Norm (GPT-2/Llama style). The two techniques are combined and hard to disentangle from their joint ablation figure, but OLMo 3 retained Post-Norm in both its 7B and 32B variants. OLMo 3 7B adds sliding window attention on top of MHA (inherited from OLMo 2) while the 32B switches to GQA. — [[2026-01-28-the-big-llm-architecture-comparison]]
