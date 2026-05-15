---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# Ampere

NVIDIA GPU architecture (compute capability 8.0/8.6), A100 generation.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Ampere（3rd gen TC）：MMA 升为 warp 级（32 线程），每 SM 4 个 TC，512 FLOPs/cycle（Volta 的 2×）；引入 `ldmatrix` 宽向量加载匹配 TC 数据布局；异步数据拷贝 `cp.async` 直接从 DRAM 写 SMEM 绕过 register file，降低 register pressure；BF16 支持（同 FP32 指数范围，7-bit mantissa，无需 loss scaling）；2:4 结构化稀疏理论 2× 吞吐但生产推理中几乎不被西方 AI 实验室使用。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
