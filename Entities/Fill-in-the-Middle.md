---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 4
tier: active
---

# Fill-in-the-Middle

FIM pretraining objective for code LLMs enabling bidirectional context-aware code infill

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[Fill-in-the-Middle]] (FIM) 让Decoder-only架构的代码LLM学会填充中间内容：将文本分为prefix/middle/suffix，middle移至末尾，用SPM或PSM格式重构输入；保留全部三段损失计算；OpenAI消融实验显示引入FIM后左到右生成的Perplexity不增反降（"FIM-for-free"）。 — [[2025-05-27-大模型-fim-预训练任务是什么-feishu-docs]]
- [[Seed-Coder]] 使用SPM模式优于PSM：注意力机制位置偏差使SPM将prefix结尾与suffix开头分置两端，更利于中间内容预测；常规预训练阶段FIM比例0.5，继续预训练阶段0.1；通过字符级随机分割支持词内补全。 — [[2025-05-27-seed-coder-feishu-docs]]
