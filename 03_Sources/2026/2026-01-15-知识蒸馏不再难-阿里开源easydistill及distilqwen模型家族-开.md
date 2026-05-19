---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/99MVaBN9M80LoRtGdHWBwg
tags: [post-training, tooling, inference]
---

# [2026-01-15] 知识蒸馏不再难！阿里开源EasyDistill及DistilQwen模型家族，开源即用、性能强劲！

## TL;DR

阿里巴巴开源 EasyDistill 知识蒸馏工具包，支持黑盒/白盒双模式及 PPO/GRPO/DPO/CogPO 多种训练算法，并附带 DistilQwen 系列蒸馏模型（0.5B–32B），代码生成任务推理速度提升 2.3×。

## Key claims

- EasyDistill 支持两种蒸馏模式：**黑盒蒸馏**（仅用教师模型输出，适配闭源 API）和**白盒蒸馏**（对齐 top-k token 概率分布，默认 k=10 以显著降低存储开销）。
- 工具包集成四类训练算法：监督微调（SFT）、强化学习（[[PPO]]/GRPO）、直接偏好优化（DPO）、认知偏好优化（CogPO）——CogPO 专为对齐小模型自身认知能力设计，而非强行模仿大模型推理路径。
- DistilQwen 系列覆盖 System 1（DistilQwen2/2.5，指令跟随）和 System 2（DistilQwen2.5-R1，基于 [[DeepSeek-R1]] CoT 数据 + CogPO；DistilQwen-ThoughtX/Y，自适应思考深度）两类模型。
- 在代码生成任务（LiveCodeBench V2）上，经蒸馏的 Qwen2.5-3B 专用模型 Pass@1 从 11.35 升至 16.62，推理速度提升 2.3×。
- 配套开源 OmniThought 数据集（200 万条带推理冗余度 RV 和认知难度 CD 标注的思维链数据）及 DistilQwen_100K/1M 指令微调数据集。
- 工具包已集成至阿里云 PAI 平台，但本身平台无关，支持 DeepSpeed ZeRO / CPU Offloading，一行配置 JSON 即可启动蒸馏流程。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-15-知识蒸馏不再难-阿里开源easydistill及distilqwen模型家族-开/weixin-img-003.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-15-知识蒸馏不再难-阿里开源easydistill及distilqwen模型家族-开/weixin-img-004.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-15-知识蒸馏不再难-阿里开源easydistill及distilqwen模型家族-开/weixin-img-005.png)

*Other images decorative — 公众号推荐链接封面图。*

## Entities touched

[[Qwen]], [[DeepSeek-R1]], [[PPO]]

## Topics touched

[[RL Post-Training]], [[Quantization]], [[LLM Architectures]]

## Raw source

[mp.weixin.qq.com/s/99MVaBN9M80LoRtGdHWBwg](https://mp.weixin.qq.com/s/99MVaBN9M80LoRtGdHWBwg) — NeuralTalk公众号，2026-01-15，EasyDistill工具包介绍。Read 2026-05-15.
