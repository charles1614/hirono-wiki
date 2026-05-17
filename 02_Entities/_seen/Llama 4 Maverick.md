---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Llama 4 Maverick

Meta's Llama 4 Maverick 400B MoE model, representing Meta's 2025 frontier MoE entry in the gallery.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Llama 4 Maverick (400B total, 17B active) uses a classic MoE setup: 2 active experts with hidden size 8192 per expert, alternating MoE and dense transformer blocks (every other layer), and GQA not MLA. Per Raschka, DeepSeek V3 is ~68% larger in total parameters but has >2× the active parameters (37B vs 17B). The MoE style diverges from DeepSeek's many-small-expert philosophy. — [[2026-01-28-the-big-llm-architecture-comparison]]
