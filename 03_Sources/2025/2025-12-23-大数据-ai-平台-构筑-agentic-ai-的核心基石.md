---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/65OHqGdvVrML-a0KJPextw
tags: [training-infrastructure, agentic-ai, cloud-ml, chinese-source]
---

# [2025-09-24] 大数据 AI 平台：构筑 Agentic AI 的核心基石

## TL;DR

阿里云在 2025 云栖大会上发布大数据 AI 平台全面升级，围绕模型、AI 基础设施、数据基础设施、端到端工具四大要素布局 Agentic AI，推出 paiMoE 训练引擎、paiFuser 推理加速引擎以及与 NVIDIA Physical AI 软件栈的深度合作。

## Key claims

- 阿里云 PAI 与 NVIDIA 正式在 Physical AI 方向达成产品合作，PAI 将集成 Isaac Sim、Isaac Lab、NVIDIA Cosmos、Physical AI 数据集等全套 NVIDIA Physical AI 软件栈。
- paiMoE 大规模 MoE 训练引擎在 [[Qwen]]3 训练中实现端到端加速比 3 倍，训练 MFU 超过 61%；核心技术 Tangram 和 ChunkFlow 已成为 Qwen 全系模型 CPT/SFT 阶段的默认方案，ChunkFlow 被 ICML 2025 收录。
- paiFuser 针对 DiT 架构模型，在 8 卡并行推理场景下视频生成耗时最高降低 80% 以上，实现"秒级"输出。
- 推理层通过大规模 EP、PD/AF 分离、权重优化等优化，推理吞吐 TPS 增加 71%，时延 TPOT 降低 70.6%，扩容时长降低 97.6%。
- Hologres 全新向量索引 HGraph 登顶 VectorDBBench 榜单，1000 万向量在召回率第一情况下 QPS 全球第一；EMR Serverless Spark 在 TPC-DS 100TB 测试中性能提升 100% 夺冠。
- Agentic Search 架构通过多 Agent 协同、多模态数据处理和任务自主规划，在 OpenAI BrowseComp 与 Deep Research 评测中超越 Gemini、OpenAI，复杂任务准确率提升超 40%。
- 客户卓驭基于阿里云搭建超过 3 EFLOPS 的 AI 智算平台，支撑十亿级别场景数据处理及端到端世界模型和 [[VLA]] 模型训练。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

阿里云的 paiMoE+paiFuser 组合覆盖了 MoE 训练与 DiT 推理两大主流范式，与 NVIDIA Physical AI 栈的合作表明云厂商正在系统性切入具身智能基础设施。

## Entities touched

[[Qwen]], [[NVIDIA]], [[VLA]]

## Topics touched

[[MoE Training]], [[Agentic AI Infrastructure]], [[Physical AI and Robotics]]

## Raw source

[mp.weixin.qq.com/s/65OHqGdvVrML-a0KJPextw](https://mp.weixin.qq.com/s/65OHqGdvVrML-a0KJPextw) — 阿里云大数据AI平台 WeChat公众号, 2025-09-24, Chinese. Read 2026-05-15.
