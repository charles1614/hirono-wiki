---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# MTP

Multi-Token Prediction, a training and inference objective carried over from DeepSeek V3.1 into V4, enabling the model to predict multiple tokens per step.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
- Tencent Taiji team trained 5 independent MTP layers for DeepSeek-V3/R1; self-trained independent MTP2 improved over open-source MTP2 by 8.8% (MTP3: +9.0%). Using Typical Sampling with dynamic temperature raised per-layer token acceptance rate to ~0.7 (vs. ~0.51 for strict token-by-token, ~0.56 for rejection sampling). All MTP layers share a single CUDA graph execution with the main model to avoid small-operator gaps. — [[2025-08-18-腾讯太极团队实现deepseek模型业内h20最高性能15800-tokens-]]
