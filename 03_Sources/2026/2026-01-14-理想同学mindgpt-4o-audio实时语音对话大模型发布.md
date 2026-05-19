---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/I56tirCF_IZCSddIvNT5HQ
tags: [inference, post-training, production-deployment, announcement]
---

# [2025-06-06] 理想同学MindGPT-4o-Audio实时语音对话大模型发布

## TL;DR

[[Li Auto]]发布全双工低延迟语音端到端模型MindGPT-4o-Audio，作为MindGPT-4o多模态基座预览版。理解+生成推理延迟260ms、全链路峰值800ms，在VoiceBench多类评测中领先豆包和ChatGPT，已在理想车机和手机App全量上线。

## Key claims

- **级联式端到端架构**：感知（MindGPT-4o-Audio Duplex全双工判定）→理解（MindGPT-4o LLM，基于MindGPT 3.0自研推理模型）→生成（AudioHead流式语音合成），消除传统ASR→LLM→TTS的级联延迟，实现全链路流式传送。
- **全双工延迟指标**：理解+生成推理延迟260ms；全链路峰值800ms；联网搜索时2000ms；语音生成首包延迟100ms以内；对话轮次切换准确率96.5%；打断响应率99%，Backchannel拒识率95%。
- **自适应响应机制KLT（Keep\_Listen\_Time）**：基于停顿间隙IPU（Inter-Pausal Unit）判断轮次切换时机，对明确完整请求（如"今天有什么热门新闻"）快速响应（判定延迟低至150ms），对犹豫型输入自适应等待。
- **用户评测**：24名测试者对比理想同学、豆包、ChatGPT，口语真实感满意度94%（豆包92%），交互自然度92%；端到端延迟约1100ms，显著优于豆包2100ms和GPT-4o 1900ms。
- **多模态任务规划**：业务测试集规划准确率95.55%；工具调用准确率94.25%；引入Claim-level Rerank技术，Claim F1与RAG问答效果相关系数0.212，较传统Precision@k提升2.6倍；搜索结果丰富度提升35%，专业术语识别准确率提升47%，复杂Query首次满足率提升28%。
- **工程架构**：基于RTC全双工通信，平均消息到达延迟下降67%；P-D分离多阶段调度（AudioEncode用Static Batching、Prefill用Chunked Prefill、Decode用Continuous Batching）；异构GPU部署推理成本降低50%；流式推理优化后首token延迟从1s降到20ms，语音生成首包从500ms降到60ms。
- **语音生成**：采用文本token+语音编码混合流式建模，无需传统文本前端；Style CoT方案增强风格遵循，支持多轮风格记忆；中英文发音错误率达极低水平（具体数值未披露）。
- **训练数据**：预训练使用30万小时以上连续对话语音数据；后训练高质量数据达数百万量级，数据平均正确率95%；多模态能力体系分三层优先级维度、26个能力类目；训练数据量相对冗余数据减少89%。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-14-理想同学mindgpt-4o-audio实时语音对话大模型发布/weixin-img-002.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-14-理想同学mindgpt-4o-audio实时语音对话大模型发布/weixin-img-004.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-14-理想同学mindgpt-4o-audio实时语音对话大模型发布/weixin-img-017.png)

*Other images decorative — architecture diagrams partially duplicated with body text, benchmark bar charts inline-captioned in raw.*

## Entities touched

[[Li Auto]], [[MindGPT]]

## Topics touched

[[Voice AI]], [[LLM Inference Systems]], [[Agentic AI Infrastructure]]

## Raw source

[mp.weixin.qq.com/s/I56tirCF_IZCSddIvNT5HQ](https://mp.weixin.qq.com/s/I56tirCF_IZCSddIvNT5HQ) — AI理想同学公众号，2025年6月6日，技术博客。Read 2026-05-15.
