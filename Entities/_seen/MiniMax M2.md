---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# MiniMax M2

MiniMax's MoE model series (M2, M2.5, M2.7 at 230B) featuring hybrid attention patterns in the gallery.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MiniMax M2 (230B) reverted from MiniMax M1's lightning attention to full GQA-based attention, with the team citing poor reasoning and multi-turn accuracy in the linear attention variant — the first documented production regression of linear attention at scale. M2 architecture closely mirrors Qwen3 but adds per-layer QK-Norm (distinct RMSNorm parameters per attention head, not shared across heads), twice the sparsity (4.37% active vs Qwen3's 9.36%), and partial RoPE (only the first `rotary_dim` channels get positional encoding). — [[2026-01-28-the-big-llm-architecture-comparison]]
