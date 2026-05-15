---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# RankMixer

ByteDance recommendation ranking model architecture scaling dense parameters 70x with GPU-efficient TokenMixing and per-token SparseMoE

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[ByteDance]] deployed [[RankMixer]]-1B on Douyin main feed, scaling Dense parameters 70× (16M → 1B) while keeping inference latency constant via TokenMixing (parameter-free cross-feature interaction) and per-token SparseMoE with DTSI; MFU improved ~10× to 40%+, SM Activity from 30% to 80%. — [[2025-08-02-抖音全新推荐大模型rankmixer-参数翻70倍-推理成本不涨]]
- Online A/B test on Douyin: +0.3% LT30 and +1%+ daily session duration; larger gains on low-activity users; deployed across dozens of ByteDance products including e-commerce ads. arXiv 2507.15551. — [[2025-08-02-抖音全新推荐大模型rankmixer-参数翻70倍-推理成本不涨]]
