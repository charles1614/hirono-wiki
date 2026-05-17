---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://swfvqxo30ma.feishu.cn/wiki/NKIDwQiGwijn2skB7aJcBryDndc
tags: [training, evaluation]
---

# [2025-05-27] GTE-Qwen系列：从生成模型到嵌入模型

## TL;DR

介绍Alibaba [[GTE-Qwen]] 系列嵌入模型（gte-Qwen1.5/gte-Qwen2）的三个核心训练机制：双向注意力机制、指令微调解锁预训练能力、改进对比损失；gte-Qwen2曾登MTEB排行榜第一。

## Key claims

- [[GTE-Qwen]] 从[[Qwen]] LLM Base模型微调而来，使用相同训练数据和策略；推理时通过 `is_causal=False` 关闭因果掩码启用双向注意力（普通padding mask），无需修改模型权重。
- 训练采用改进InfoNCE损失（双塔对比学习）：分母扩展至4项，除查询到文档正/负对比外，还增加反向对比（文档到查询、查询间、文档间），温度τ固定为0.01。
- Token表示取序列最后一个真实token的embedding（非[CLS]）：通过检测左侧还是右侧padding自适应选取；左padding取 `last_hidden_states[:, -1]`，右padding取 `sequence_lengths` 位置。
- 额外Instruction Tuning阶段专门解锁预训练中已学习的能力，用于embedding任务迁移。
- gte-Qwen2-7B-instruct曾登顶MTEB leaderboard第一，当前top 10中已有多个B级参数规模的模型。

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[GTE-Qwen]], [[Qwen]]

## Topics touched

[[LLM Pretraining]]

## Raw source

[swfvqxo30ma.feishu.cn/wiki/NKIDwQiGwijn2skB7aJcBryDndc](https://swfvqxo30ma.feishu.cn/wiki/NKIDwQiGwijn2skB7aJcBryDndc) — Feishu知识库（lark-hirono API），2025-05-27. Read 2026-05-16.
