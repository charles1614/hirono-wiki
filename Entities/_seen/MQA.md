---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# MQA

Multi-Query Attention: attention variant sharing a single K/V head across all query heads to reduce KV cache footprint

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MQA在MLA中作为引入RoPE位置编码的子机制：由于RoPE与低秩KV不兼容（位置矩阵Rt-j随位置变化无法矩阵吸收），DeepSeek在64维子空间用MQA方式计算共享k^R（所有head共享），最终attention = q^C·k^C + q^R·k^R；MLA的总KV缓存量约等于2.25个MQA的缓存量，但表达能力显著强于GQA和MQA。 — [[2025-06-05-deepseek技术解读-1-彻底理解mla-multi-head-latent]]
