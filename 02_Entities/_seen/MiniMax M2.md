---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# MiniMax M2

MiniMax's MoE model series (M2, M2.5, M2.7 at 230B) featuring hybrid attention patterns in the gallery.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MiniMax M2 (230B) reverted from MiniMax M1's lightning attention to full GQA-based attention, with the team citing poor reasoning and multi-turn accuracy in the linear attention variant — the first documented production regression of linear attention at scale. M2 architecture closely mirrors Qwen3 but adds per-layer QK-Norm (distinct RMSNorm parameters per attention head, not shared across heads), twice the sparsity (4.37% active vs Qwen3's 9.36%), and partial RoPE (only the first `rotary_dim` channels get positional encoding). — [[2026-01-28-the-big-llm-architecture-comparison]]
- MiniMax M2.7 API pricing (as of 2026-03): uncached input 2.1 RMB/1M, cached input 0.42 RMB/1M, output 8.4 RMB/1M, 200K context; Token Plan replaced prompt-counting with request-counting but effective limits are unchanged. M2.7 (230B/10B active) has no vision capability. — [[2026-03-20-ai-coding-plan-杰哥的知识库]]
