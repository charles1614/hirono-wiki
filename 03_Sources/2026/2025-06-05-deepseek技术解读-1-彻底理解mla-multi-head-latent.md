---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/16730036197
tags: [inference, attention-kernels, kv-cache]
---

# [2025-01-09] DeepSeek技术解读(1) — 彻底理解MLA（Multi-Head Latent Attention）

## TL;DR

深入解析DeepSeek MLA（Multi-Head Latent Attention）的设计原理：通过低秩KV压缩和矩阵吸收计算，将KV Cache从MHA的每Token 128×64×2=16384维压缩至576维（4dh + dh/2），同时保持接近MHA的表达能力，使推理访存开销大幅降低。

## Key claims

- MLA的核心是低秩KV压缩：将K/V投影到一个低维潜变量 c^{KV}（512维），推理时只缓存该潜变量而非完整K/V，相当于2.25个[[MQA]]的缓存量，但特征表达能力显著强于[[GQA]]和[[MQA]]。
- RoPE与低秩KV不兼容：若对压缩后的K施加RoPE，则因位置矩阵Rt-j随位置变化，W^UK无法被W^UQ矩阵吸收，需在推理时重新计算所有前序K，极大降低效率。
- DeepSeek的解法是decoupled RoPE：在64维的子空间内用MQA方式引入位置编码，所有Head共享一个k^R；完整attention weight = q^C·k^C + q^R·k^R（两部分拼接后相乘）。
- 矩阵吸收计算使V也无需缓存：W^UV可被最终的输出变换矩阵W^O吸收，因此实际只缓存c^{KV}和共享k^R两个向量。
- 与[[DeepSeek-V2]]实验数据对比：MLA在KV Cache量仅为MQA的2.25倍时，模型性能超越GQA并接近MHA，实现了"又快又省又强"。

## Visual observations

*No load-bearing images — all panels inline-captioned in raw, no standalone images.*

## What this changes

MLA提供了一种将KV Cache压缩至原始1/5以下而几乎不损性能的方案，DeepSeek-V3的256-Expert MoE部署得益于此。未来超大专家数模型（1024 Expert）的推理显存瓶颈将更多来自Expert参数而非KV Cache。

## Entities touched

[[MLA]], [[DeepSeek-V3]], [[DeepSeek-V2]], [[KV Cache]], [[MQA]], [[GQA]], [[MHA]], [[RoPE]], [[FlashMLA]]

## Topics touched

[[Attention Kernels]], [[KV Cache Management]]

## Raw source

[zhuanlan.zhihu.com/p/16730036197](https://zhuanlan.zhihu.com/p/16730036197) — 姜富春，Zhihu专栏，2025-01-09。Read 2026-05-16.
