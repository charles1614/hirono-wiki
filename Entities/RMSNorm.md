---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# RMSNorm

Normalization technique that scales by RMS without centering, used in Llama and other LLMs as pre-normalization

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Implemented in a scaled-down [[Llama]] re-implementation as pre-normalization (`RMSNorm((context_window, d_model))` applied before attention and feedforward layers); the RMS property is unit-testable: `norm(ffx, dim=(1,2))**2 == num_elements`; reduces validation loss from 2.5 to ~2.50 marginally but stabilizes training. — [[2025-05-20-llama-from-scratch-or-how-to-implement-a]]
- Identified as a special case within Attention Residuals ([[Attention Residual]]): since `RMSNorm(cx) = RMSNorm(x)` for any scalar c, the weighted average and weighted sum of inter-layer states are equivalent when followed by RMSNorm — this means the normalization constraint in AttnRes does not reduce expressivity. — [[2026-03-22-kimi弃用残差连接背后-苏剑林第一视角解析attention-residual]]
