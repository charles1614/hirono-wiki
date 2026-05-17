---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://swfvqxo30ma.feishu.cn/wiki/J4CQwxPruisyFXk599AcIdDInPh
tags: [pretraining, training]
---

# [2025-05-27] 大模型FIM预训练任务是什么？

## TL;DR

介绍Fill-in-the-Middle（FIM）预训练方法的原理、两种模式（SPM/PSM）及"FIM-for-free"现象，说明FIM如何让Decoder-only架构的代码LLM获得双向补全能力。

## Key claims

- Decoder-only架构单向注意力无法原生支持填充中间位置；OpenAI论文《Efficient Training of Language Models to Fill in the Middle》提出FIM：将文本分为prefix/middle/suffix三段，把middle移到最末，用SPM（Suffix-Prefix-Middle）和PSM（Prefix-Suffix-Middle）两种等效格式重构输入。
- [[Fill-in-the-Middle]] 保留prefix、middle、suffix全部三段的损失计算，与常规预训练损失统一；FIM任务以一定概率与常规预训练任务混合，[[Seed-Coder]] 常规预训练阶段FIM比例为0.5，继续预训练阶段降至0.1。
- "FIM-for-free"现象：OpenAI消融实验显示，随FIM比例提升，模型在传统左到右生成的Perplexity不增反降，几乎"免费"获得infill能力。
- 近期研究多采用PSM单模式，但实验发现SPM更优，原因可能是注意力机制的位置偏差：SPM将prefix结尾与suffix开头分置两端，更利于中间内容预测。
- SPM技术实现：通过字符级随机分割支持词内补全（subword infill），文档转为含特殊标记的结构化格式 `<[fim-suffix]>后缀<[fim-prefix]>前缀<[fim-middle]>中间内容`。

## Visual observations

*No load-bearing images — figures inline-captioned in raw, no standalone images.*

## Entities touched

[[Fill-in-the-Middle]], [[Seed-Coder]]

## Topics touched

[[LLM Pretraining]]

## Raw source

[swfvqxo30ma.feishu.cn/wiki/J4CQwxPruisyFXk599AcIdDInPh](https://swfvqxo30ma.feishu.cn/wiki/J4CQwxPruisyFXk599AcIdDInPh) — Feishu知识库（lark-hirono API），2025-05-27. Read 2026-05-16.
