---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/1911899575096186325
tags: [inference, moe]
---

# [2025-05-31] 你相信大EP么？

## TL;DR

业内视角分析大规模Expert Parallelism（大EP）部署的经济学和工程约束：[[DeepSeek-V3]]的256-Expert MoE触发了大EP热潮，但在专家数达到1024量级后，Scale-Up NVLink域的需求将超出当前可行边界，cold/hot专家分类将成必要。

## Key claims

- MoE的最优部署曲线形如浴盆：两端是一体机（全专家单卡）和大EP（每专家全卡激活），中间范围因BSP不均衡的二阶放大效应形成深坑。
- 大EP的前提是足够多的并发用户确保每位"专科医生"满负荷——DeepSeek-V3 256 expert需要极高并发才能让所有256个expert均衡负载。
- 若下一代模型扩至1024 expert，所需并发量相比V3至少增加4倍，规模化大EP部署困难显著提升；cold/hot专家分类是可能的出路。
- Scale-Up是保障单用户高token/s的必要条件，Scale-Out（跨机）无法达到同等的单用户推理延迟。
- 作者以"清华男生聊天无需控制语速、秒懂秒回"类比高token/s的用户体验价值，强调延迟本身是产品差异化维度。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

大EP是当前[[DeepSeek-V3]]和NVL512等Scale-Up产品的核心卖点之一，但其可扩展性在更大专家数量时面临需求量天花板，预示着MoE服务架构需引入专家冷热分类等新机制。

## Entities touched

[[DeepSeek-V3]], [[DeepSeek]], [[Expert Parallelism]], [[MoE]]

## Topics touched

[[MoE Serving]], [[Expert Parallelism]]

## Raw source

[zhuanlan.zhihu.com/p/1911899575096186325](https://zhuanlan.zhihu.com/p/1911899575096186325) — Dio-晶，Zhihu专栏，2025-05-31。Read 2026-05-16.
