---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 6
tier: active
---

# Seed-Coder

ByteDance open-source code LLM family (8B Base/Instruct/Reasoning) using model-centric data curation

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[Seed-Coder]] 是[[ByteDance]]开源的8B代码LLM家族（Base/Instruct/Reasoning），用LLM代替人工规则自动化评分和筛选代码数据，构建6T token预训练语料库；预训练三阶段（基础1T + 代码强化4T + 长上下文1T），[[Fill-in-the-Middle]]比例0.5→0.1；Reasoning模型用GRPO+DAPO从Base出发，分阶段渐进式探索（16K/16样本→32K/32样本）。 — [[2025-05-27-seed-coder-feishu-docs]]
- [[Seed-Coder]] 使用[[Fill-in-the-Middle]]训练时，常规预训练阶段FIM比例0.5，继续预训练阶段降至0.1；SPM模式（Suffix-Prefix-Middle）优于PSM，原因可能是注意力位置偏差使prefix结尾与suffix开头分置两端更利于中间内容预测。 — [[2025-05-27-大模型-fim-预训练任务是什么-feishu-docs]]
