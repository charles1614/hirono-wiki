---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/0FQy02cR9dqlv7av-5PZGA
tags: [inference, survey, moe]
---

# [2025-07-25] 从 DeepSeek-V3 到 Kimi K2：八种现代 LLM 架构大比较

## TL;DR

Sebastian Raschka 撰文，Datawhale 编译，系统对比 DeepSeek V3/R1、OLMo 2、Gemma 3、Mistral Small 3.1、Llama 4、Qwen3、SmolLM3 和 Kimi K2 八种现代 LLM 的架构差异。核心发现：七年来 Transformer 基础结构惊人稳定，真正分化体现在注意力机制（MLA vs GQA vs MHA）、归一化层位置（Pre-Norm vs Post-Norm）、专家设计（MoE vs 密集）和位置编码（RoPE vs NoPE）四个维度。

## Key claims

- [[DeepSeek-V3]] 的两大核心创新：MLA（多头潜在注意力）通过在 KV 缓存写入前压缩 K/V 张量至低维空间来大幅降低内存占用；MoE 使用 256 个专家但每次推理仅激活 9 个（1 个共享 + 8 个路由选择）。
- [[OLMo]] 采用 Post-Norm（归一化层置于注意力/前馈模块之后），与大多数 LLM 的 Pre-Norm（GPT-2、Llama 3 等）不同；同时引入 QK-Norm（在 RoPE 之前对 q/k 施加额外 RMSNorm）增强训练数值稳定性；仍使用传统 MHA 而非 [[GQA]]。
- [[Gemma]] 3 在注意力和前馈模块前后均放置 RMSNorm（前+后双归一化）；滑动窗口大小从 Gemma 2 的 4096 缩减至 1024，全局与局部注意力比例调整，研究表明对建模性能影响极小但显著降低 KV 缓存内存。
- Mistral Small 3.1 放弃滑动窗口注意力改用 FlashAttention，通过自定义分词器 + 缩小 KV 缓存 + 减少层数降低推理延迟。
- [[Kimi K2]] 基于 DeepSeek V3 架构扩展，使用 Muon 优化器（而非 AdamW），MoE 使用更多专家，MLA 使用更少的 head；训练损失曲线平滑下降迅速。
- [[SmolLM3]]（3B 参数）使用 NoPE（无位置嵌入），完全依赖因果注意力掩码保持自回归顺序，研究表明在长度泛化（处理更长序列时性能下降更少）方面优于 RoPE。
- [[Qwen]] 3 密集模型采用更深架构（更多 Transformer 块、更少注意力头），相比 Llama 3 内存占用更小但生成速度更慢；Qwen3 MoE 与 DeepSeek V3 类似但不使用共享专家。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较/weixin-img-001.png)

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较/weixin-img-003.png)

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较/weixin-img-013.png)

*Other images decorative — per-model architecture diagrams inline-captioned in raw body text.*

## What this changes

为 LLM 架构演化提供了横向快照：MLA 正成为内存高效注意力的主流选择，NoPE 的长度泛化优势引发关注，MoE 专家数量和共享专家设计差异正成为模型间的重要分水岭。

## Entities touched

[[DeepSeek-V3]], [[Kimi K2]], [[MLA]], [[MoE]], [[GQA]], [[Llama]], [[Qwen]], [[OLMo]], [[Gemma]], [[SmolLM3]], [[Sebastian Raschka]]

## Topics touched

[[LLM Architectures]]

## Raw source

[mp.weixin.qq.com/s/0FQy02cR9dqlv7av-5PZGA](https://mp.weixin.qq.com/s/0FQy02cR9dqlv7av-5PZGA) — Datawhale 公众号，Sebastian Raschka 著，PaperAgent 编译，2025-07-25，微信文章。Read 2026-05-15.
