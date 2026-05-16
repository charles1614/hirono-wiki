---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://swfvqxo30ma.feishu.cn/wiki/RAaYwrRvriuHohkLFa8cHpnunrd
tags: [pretraining, post-training, training]
---

# [2025-05-27] Seed-Coder：让代码模型为自己策划数据

## TL;DR

[[Seed-Coder]] 是[[ByteDance]]开源的8B代码LLM家族（Base/Instruct/Reasoning），核心创新是用LLM代替人工规则自动化评分和筛选代码数据，构建6T token预训练语料库。

## Key claims

- 模型架构基于Llama 3：8.2B参数、32层、隐层4096维、中间层14336维，GQA（32查询头/8KV头），预训练阶段上下文8K后扩展至32K tokens，词表155,136。
- 数据管道三阶段：GitHub代码（~1T token高质量代码库，覆盖89种语言，用1.3B Llama 2回归评分器对可读性/模块化/清晰性/可复用性打[0,1]分，过滤底部10%）+ Git提交（100B token，选自≥100星/≥10fork/≥100提交的140K仓库）+ 网页代码（~1.2T token，FastText召回99%+LLM质量评分动态阈值）。
- 预训练三阶段共6T token：基础预训练1T（代码+数学网络数据，lr=3×10⁻⁴）→代码强化4T→长上下文优化（0.4T@lr/√10 + 0.6T@3×10⁻⁵）；[[Fill-in-the-Middle]]比例常规阶段0.5，继续预训练阶段0.1。
- Instruct模型：SFT用~3M高质量指令对（难度感知采样，序列打包，3轮/lr=2e-5）+ DPO用~20K偏好对；引入沙盒自校正迭代保留高难度样本。
- Reasoning模型：从Base模型出发（避免SFT模式锁死），LongCoT预热后用GRPO算法（verl框架+DAPO优化）训练；分阶段：16K序列/16样本90步→32K序列/32样本160步；超参bs=128、lr=1×10⁻⁶、温度0.6、剪裁比率0.28；Curriculum Learning过滤正确率>87.5%的简单问题。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Seed-Coder]], [[ByteDance]], [[Fill-in-the-Middle]]

## Topics touched

[[LLM Pretraining]], [[RL Post-Training]]

## Raw source

[swfvqxo30ma.feishu.cn/wiki/RAaYwrRvriuHohkLFa8cHpnunrd](https://swfvqxo30ma.feishu.cn/wiki/RAaYwrRvriuHohkLFa8cHpnunrd) — Feishu知识库（lark-hirono API），2025-05-27. Read 2026-05-16.
