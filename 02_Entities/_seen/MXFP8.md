---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# MXFP8

Microscaling FP8 block-quantization format with per-32-element shared scale factors

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MXFP8（OCP 2023）为每 32 个连续元素分配独立缩放因子（E8M0 格式，8 位表示 2 的幂）；相比每张量单一 FP32 缩放因子的标准 FP8，动态范围约束更宽松，可全部使用 E4M3 格式；Blackwell 张量核心要求 MXFP8 数据在约简维度连续，转置时需重新量化（非仅数值重排），是 B200 训练的主要性能开销之一。 — [[2025-08-28-深度解析-deepseek为什么要推ue8m0-fp8]]
- DeepSeek UE8M0 FP8 是 MXFP8 的变种：无符号 8 位指数（缩放因子）、零尾数（量化查找表替代），设计针对 AI 计算中 ReLU 负值稀少 + 权重动态范围大的特点；在 DeepSeek-V3.1（671B）中使梯度溢出率降低 99.7%，训练速度提升 3.15×。 — [[2025-08-28-深度解析-deepseek为什么要推ue8m0-fp8]]
