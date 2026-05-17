---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/aA72wF8LJrnXrW6uCLHikA
tags: [pretraining, attention-kernels]
---

# [2026-03-20] Kimi弃用残差连接背后：苏剑林第一视角解析Attention Residuals

## TL;DR

Su Jianlin (author at Moonshot AI / 科学空间) explains the design journey behind Attention Residuals (AttnRes), which replaces fixed equal-weight residual connections between transformer layers with a learned inter-layer attention mechanism, providing a first-person account of the architectural decision behind Kimi's abandonment of standard residuals.

## Key claims

- Standard residuals can be rewritten as equal-weight sum of all intermediate states; the natural generalization is a learned weighted sum — this is the core idea of AttnRes: replace `x_l = x_{l-1} + f_l(x_{l-1})` with a weighted combination across all previous layer outputs.
- Two constraints are imposed: (1) weights must be non-negative to ensure each layer contributes in the same direction; (2) with RMSNorm's scale-invariance `RMSNorm(cx) = RMSNorm(x)`, the weighted average and weighted sum are equivalent — no expressivity is lost by normalizing weights.
- Hyper-Connections (HC) by [[DeepSeek]] (mHC variant) is shown to be a special case of inter-layer attention: it expands the state variable k-fold (k=4 is classic), uses a k×1 projection for input and 1×k for output; AttnRes is the more general route.
- The AttnRes paper is referenced as work from Moonshot AI (Kimi's parent); this article is a retrospective from the lead researcher.
- Pre/Post Norm debate is characterized as "internal conflict within residuals" — AttnRes takes a more radical path of replacing residuals entirely.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

Demonstrates that inter-layer attention is a principled generalization of residuals, not just an architectural quirk; provides the theoretical framing that subsumes HC, Highway networks, and Post Norm as special cases.

## Entities touched

[[Attention Residual]], [[Kimi K2]], [[DeepSeek]], [[RMSNorm]]

## Raw source

[mp.weixin.qq.com/s/aA72wF8LJrnXrW6uCLHikA](https://mp.weixin.qq.com/s/aA72wF8LJrnXrW6uCLHikA) — PaperWeekly WeChat article by Su Jianlin (科学空间), published 2026-03-20. Read 2026-05-16.
