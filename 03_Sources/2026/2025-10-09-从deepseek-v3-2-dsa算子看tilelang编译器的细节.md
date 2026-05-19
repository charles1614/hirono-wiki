---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/G0bA0BeeuXIApJjj5MzBDA
tags: [attention-kernels, gpu, inference, low-precision]
---

# [2025-10-09] 从DeepSeek V3.2 DSA算子看TileLang编译器的细节

## TL;DR

深度解析 [[DeepSeek-V3.2]] 的 DeepSeek Sparse Attention（DSA）三个核心算子（Lightning Indexer、Top-k Selector、Sparse MLA）的 [[TileLang]] 实现，展示 TileLang 如何通过 tile-level 编程模型高效表达稀疏注意力计算。

## Key claims

- DSA 将注意力计算复杂度从 O(N²) 降至 O(N×K)，K 为 top-k 大小（远小于序列长度 N），由三个模块组成：Lightning Indexer（FP8 GEMM 快速相似度筛选）、Top-k Selector（O(N) Radix Sort 两阶段选 K）、Sparse MLA（仅在 top-k 位置计算完整注意力）。
- Lightning Indexer 用低维 FP8 Index Vectors 计算 `ReLU(Q_index @ K_index^T) * weights`，通过 per-token CuSeqLenKS/KE 边界跳过无关计算，避免全量 FP16 GEMM 的代价。
- Top-k Selector 采用两阶段算法：Stage 1 将 float32 logits 转为 uint16 建 8 位直方图确定阈值 bin（O(N)），Stage 2 对阈值 bin 内元素最多 4 轮 8 位 Radix Sort 精化，整体避免 O(N log N) 全排序。
- [[TileLang]] 以 tile 为基本操作粒度，通过 T.gemm / T.reduce 等原语直接描述 GPU 共享内存层次的数据流动，相比 Triton 在表达复杂数据布局和 pipelining 时更显式。
- DeepSeek V3.2 的 MLA forward 在 Sparse MLA 路径中迭代 top-k 个 block 索引加载 KV，而非全序列顺序加载，利用 TopK_Indices 实现稀疏访问。
- 作者指出复杂算子（如 Sparse MLA）的 TileLang 实现仍需深度参与 TileLang 开发才能编写，对应 TileLang commit 7fb06776。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-09-从deepseek-v3-2-dsa算子看tilelang编译器的细节/weixin-img-001.png)
*DeepSeek V3.2 DSA 架构图，展示 Lightning Indexer → Top-k Selector → Sparse MLA 三级流水线结构。*

*Other images decorative — code screenshots.*

## What this changes

- 为社区提供了 DSA 算子的 TileLang 参考实现路径，证明 TileLang 可用于表达复杂稀疏注意力内核，但门槛仍高于 Triton。

## Entities touched

[[DeepSeek-V3.2]], [[TileLang]], [[DeepSeek]]

## Topics touched

[[Attention Kernels]]

## Raw source

[mp.weixin.qq.com/s/G0bA0BeeuXIApJjj5MzBDA](https://mp.weixin.qq.com/s/G0bA0BeeuXIApJjj5MzBDA) — WeChat 公众号"GiantPandaLLM"，2025-10-09，HTML 转 Markdown。Read 2026-05-15.
