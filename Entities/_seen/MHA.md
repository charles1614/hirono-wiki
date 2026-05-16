---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# MHA

Multi-Head Attention — the primary kernel target in the AVO paper, where 7 days of autonomous evolutionary search on B200 produced kernels outperforming cuDNN by 3.5% and FlashAttention-4 by 10.5%.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MHA的KV Cache在MLA对比中是基准线：每Token完整KV为n_h × d_h × 2 = 128 × 64 × 2 = 16384维（DeepSeek-V3配置），相比MLA的576维压缩约28×；但MLA在DeepSeek-V2消融实验中性能超越MHA，说明低秩压缩不仅节省显存还有质量提升。 — [[2025-06-05-deepseek技术解读-1-彻底理解mla-multi-head-latent]]
