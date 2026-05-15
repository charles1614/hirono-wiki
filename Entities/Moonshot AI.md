---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# Moonshot AI

Chinese AI lab that developed the Kimi K2 / K2.5 / K2.6 1T open-weights MoE model family.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Moonshot AI 的 AI Infra 团队在推理延迟优化方面将"latency bound 算子"作为核心约束：认为 topk、小矩阵 gemm 在小 batch decode 场景下无法靠新硬件（Blackwell）或增加并行度解决，只能靠 IO fusion、算子 overlap 或开销摊薄来处理——这一认知直接驱动了 [[Attention Residual]] Block AttnRes 的 two-phase computation 设计。 — [[2026-03-21-https-zhuanlan-zhihu-com-p-2017528295286]]
