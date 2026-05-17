---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/5I9pcORVvgh8yC3F5lqDcA
tags: [inference, attention-kernels, post-training, announcement]
---

# [2026-01-12] 直播预告 | RTPurbo：小时级训练实现Qwen3-480B模型5X Attention压缩

## TL;DR

[[RTP-LLM]] 团队（阿里巴巴）提出 RTPurbo 后训练压缩方案：仅保留约15%关键"长程头"做全局注意力，其余头部专注局部信息，实现5倍Attention计算压缩，且仅需小时级微调+约1万条数据即可恢复长文本任务表现。

## Key claims

- RTPurbo 识别出模型中约15%的"长程头"（long-range heads）负责全局注意力，其余头部只需关注局部信息；对后者截断远程注意力可实现高达5倍Attention计算压缩。
- 通过"自蒸馏"（self-distillation）训练范式，压缩后模型仅需小时级轻量微调与约1万条训练数据即可在长文本任务上恢复至原模型水平，同时保留短文本通用对话、推理与代码能力。
- 该方案已应用于 [[Qwen]] 3-480B 模型，验证了在超大规模MoE模型上的可行性。

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[RTP-LLM]], [[Qwen]]

## Topics touched

[[Attention Kernels]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/5I9pcORVvgh8yC3F5lqDcA](https://mp.weixin.qq.com/s/5I9pcORVvgh8yC3F5lqDcA) — ModelScope社区公众号，2026年1月12日，直播预告文章。Read 2026-05-15.
