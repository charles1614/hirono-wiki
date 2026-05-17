---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/2017528295286133070
tags: [inference, training, parallelism, attention-kernels, gpu]
---

# [2026-03-21] 谈谈 Attention Residual 架构一些背后的想法

## TL;DR

Moonshot AI Infra 工程师 YyWangCS 从推理架构角度深度解析 **Block Attention Residual (AttnRes)** 的设计历程：为何从 Full AttnRes 退步到 Block AttnRes，以及 two-phase computation 如何在几乎不引入额外延迟的前提下（实测 < 2% decode latency overhead）保留 cross-layer aggregation 的表达能力。文章同时揭示了一个反直觉结论：Full AttnRes 在推理侧是可行的（显存按 TP 维度分摊后降至 ~2GB/卡），真正的工程瓶颈是访存量（O(L²) → two-phase 优化到 O(√L)）以及训练侧的跨 PP 通信问题——后者最终推动了 Block 结构的确定。

## Key claims

- **延迟优化 ≠ 成本优化**。成本优化手段（大 batch、kernel pipeline 提升利用率）对延迟无直接帮助；反过来，增加并行度缩短 critical path 可降延迟但不减总计算量。ScMoE 是前者的典型，Block AttnRes 显式以后者为目标。
- **Latency bound 算子的特殊性**：topk、小尺寸 matmul（如 HyperConnection 的 `tf32_hc_prenorm_gemm`）在小 batch decode 场景下占据关键路径，且（1）无法靠增加并行度解决；（2）新硬件（Blackwell）算力翻倍未必使其变快——瓶颈在 launch/同步/访存，而非理论算力。
- **Block AttnRes 的核心设计**：每层的 attention query 是与当前 hidden state **解耦的可学习参数**，这使同一 block 内所有层的 query 可提前批量计算，从而拆分为两阶段：
  - **Phase 1: batched inter-block attention** — block 内所有层统一与历史 block representations 做一次批量 attention，得到每层的 inter-block partial result 及 softmax 统计量（lse、max）。
  - **Phase 2: sequential intra-block attention + online softmax merge** — 按层顺序推进 intra-block 部分，通过 online softmax 精确合并两部分结果（非近似算法，数值等价）。
- **IO 分析**：baseline FusedAddRMSNorm 每层访存 ~4D。Block AttnRes Phase 2 增加 1D（→ 5D），Phase 1 平摊到每层增加 ~1.5D，总额外开销 **~2.5D**，量级类似一次轻量 RMSNorm。实测：batch=128、64 个 Transformer Decoder Block 配置下，端到端 decode latency 增加 < 0.5 ms；结合 MTP 可进一步摊薄。
- **显存优化**：block representations 沿 sequence 维度切分到 TP 各卡，单卡 block cache 从 `N × T × d` 降至 `N × (T/P) × d`。128K context、8 blocks、d=7168、8 卡 TP 场景下：15 GB → 1.9 GB/卡；再配合 32K chunk prefill 可降至 < 1 GB。
- **Full AttnRes 的推理可行性分析**（未上线但技术上已突破）：访存量问题（最坏情形 H200 上引入 ~2s 额外开销）通过 full 版本 two-phase computation 解决，将每层访存从 O(L) 优化到 O(L/N + N) = O(√L)，大约降至原来的六分之一。真正阻碍上线的是**训练侧的跨 PP 通信问题**，最终推动了 Block AttnRes 的确定。
- **最终 Block 超参选择**：block_num=8（对应 S=16 layers/block，总 N=8 blocks），综合满足训练效率、接近 O(√L) 最优 block_num、以及算法效果；同期公司流量爆增使零延迟开销成为硬约束。
- **苏剑林提出通用数学形式** (general full attention)，给出完备理论分析，初步实验验证效果优势——这给了 Infra 侧"认真做"的信心。Infra 侧在完成 two-phase 设计后反向拍板"Full AttnRes 推理可行"，又激励了算法侧继续推进。

## Visual observations

*No load-bearing images — source has no images*

## What this changes

- **将 Attention Residual 的工程可行性公开文档化**：论文中受篇幅限制的工程分析（two-phase 的 IO 计算、显存 TP 分摊、latency bound 算子的挑战）在这篇文章中得到完整展开。是理解 Block AttnRes 架构决策的第一手工程文档。
- **确认了"系统约束决定架构形态"的设计哲学**：Block vs Full 的选择不是算法优劣问题，而是训练侧跨 PP 通信 + 推理侧延迟硬约束在当时硬件条件下的平衡点。随硬件发展，全 Full AttnRes 仍是目标。

## Entities touched

[[Moonshot AI]], [[Kimi K2]], [[Attention Residual]], [[Su Jianlin]], [[Blackwell]], [[MLA]], [[MTP]], [[MoE]], [[FlashAttention]]

## Topics touched

[[LLM Architectures]], [[LLM Inference Systems]]

## Raw source

[zhuanlan.zhihu.com/p/2017528295286133070](https://zhuanlan.zhihu.com/p/2017528295286133070) — 知乎专栏文章 · ~10 KB · 纯文本，无图片 · YyWangCS（月之暗面 AI Infra）· 发布于 2026-03-20 · 0 fences · 0 tables · zhihu-article 适配器抓取。
