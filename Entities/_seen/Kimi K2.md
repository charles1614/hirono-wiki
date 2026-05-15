---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Kimi K2

Moonshot AI's 1T-parameter open-weights MoE model, the first 1T open-weights model, with K2.5 and K2.6 successors.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Kimi K2 (1T total, 32B active) is structurally a scaled-up DeepSeek V3 — same MLA + sparse MoE blueprint but more experts and fewer MLA heads. As of Raschka's survey, it was the largest open-weight model. It is also the first production model to use the Muon optimizer (over AdamW) at this scale, with exceptionally smooth training loss decay. Kimi K2 Thinking (Nov 2025 update) extends context from 128k to 256k with no architecture change. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Kimi Linear (48B, Oct 2025) is a Kimi-team linear-attention hybrid combining Kimi Delta Attention (channel-wise gated DeltaNet variant) with MLA-based full-attention layers in a 3:1 linear:full ratio. Uses NoPE in the MLA layers to avoid RoPE retuning for long-context scaling. At 48B, shows favorable accuracy vs speed tradeoffs vs GatedDeltaNet-H1. — [[2026-01-28-the-big-llm-architecture-comparison]]
