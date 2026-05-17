---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/YUqIyq_o5iVMBChOa3s_1w
tags: [inference, gpu, tooling, production-deployment]
---

# [2026-03-24] 记录下SGLang开发，优化，debug的技巧之大SKILL时代已来临

## TL;DR

GiantPandaLLM作者（BBuf）的开发心得，写于2026年3月24日。核心论点：Coding Agent（[[Claude Code]] + [[OpenAI Codex]]）已进入"真正的智能"阶段，尤其在GPU推理框架开发领域。SGLang团队已将开发者经验蒸馏为可复用的SKILL文档，代理可自主完成kernel编写、benchmark、CUDA crash debug、自动二分bad commit等任务。人的价值正从"亲手写代码"转向"定义问题、提炼SKILL、把关结果"。

## Key claims

- **Agent冲击已至**：Codex + GPT5.4 Extra High 用于SGLang开发，2周内完成了大量以往需要大量人力的工作；与2025年的体验完全不同，"真正的智能似乎已经出现"。
- **SKILL驱动的性能提升**：基于Codex + SGLang SKILL，SGLang Diffusion的Z-Image单卡速度提升40%，Qwen/Qwen-Image-2512单卡速度提升20%+，同时挖掘出一个kernel fuse pattern（PR #20395）。
- **CUDA crash debug SKILL**（PR #20910）：受Flashinfer API logging启发，在kernel调用层面增加分级日志（1/3/5/10），让Agent能自动定位出错的kernel，无论是接口层面还是kernel层面的crash。
- **SKILL构建方法论**：(1) 蒸馏自己/前人的开发经验成SKILL；(2) 引入高含金量的外部知识（cutlass/triton系列博客、专门的人类代码优化库）作为Agent资料库；(3) 关注流程设计——目标不清晰、context不充分、验证标准不过硬，再强的模型也会"高速生产一堆看着像回事但并不正常work的东西"。
- **警惕Agent偏离**：不能让Agent挂在那里完全不看开发流程就直接取结果，当前Agent仍会出现偏离方向的修改，造成破坏性后果。
- **人的价值重构**：从"亲手扣kernel、手动串benchmark和debug"变成"能把经验沉淀成SKILL、搭出自动验证闭环、一眼看出Agent产出有没有走偏"。稀缺能力是"知道该优化什么、瓶颈大概在哪、怎么设计稳定可复用的流程"。作者将其概括为"蒸馏世界的知识，蒸馏AI的输出，最后蒸馏自己"。
- **AKO4ALL框架**：专为kernel开发设计的Agent框架（github.com/TongmingLAIC/AKO4ALL），等待40分钟可让整个模型端到端性能再提升2个百分点。

## Visual observations

5张截图随文附图，内容为：Codex执行过程截图、AKO4ALL框架产出示例（前后性能对比）、性能提升图表、"程序员在监控Agent"梗图。截图本身不载有具体数字或结构信息，叙事已在正文中捕获。

*No load-bearing images — screenshots are illustrative examples embedded in commentary; all quantitative claims are stated in prose.*

## What this changes

- 补全了**SKILL模式的宏观叙事**：[[2026-03-16-sglang-claude-skills-add-jit-kernel-skil]] 记录了SKILL的技术规范（JIT kernel添加的五步runbook），本源记录了SKILL模式的**实践者视角与心得**——性能收益、构建方法论、使用陷阱。两者合读构成SKILL模式的完整图景。
- **CUDA crash debug SKILL**（PR #20910）首次出现在corpus中，作为SGLang SKILL生态的第四个已知成员（其余三个见 [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]]）。
- 为[[Kernel Authoring]]主题增加了**Agent辅助kernel优化的实证数据**：AKO4ALL框架 + 40分钟自动优化 → 端到端性能+2%，是corpus中较具体的自动kernel优化收益数据点。

## Entities touched

[[SGLang]], [[Claude Code]], [[OpenAI Codex]]

## Topics touched

[[GPU Programming Models]], [[Kernel Authoring]]

## Raw source

[mp.weixin.qq.com — 记录下SGLang开发，优化，debug的技巧之大SKILL时代已来临](https://mp.weixin.qq.com/s/YUqIyq_o5iVMBChOa3s_1w) — 微信公众号 GiantPandaLLM · 2026年3月24日 · ~2.8 KB · 5张截图. Fetched 2026-05-10 via weixin adapter.
