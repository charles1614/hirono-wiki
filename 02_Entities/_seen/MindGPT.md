---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# MindGPT

Li Auto's in-house multimodal LLM powering the 理想同学 (LiXiang Tongxue) in-car AI assistant

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MindGPT-4o-Audio是级联式端到端语音大模型（Duplex全双工感知→MindGPT-4o LLM理解→AudioHead流式合成），消除传统ASR→LLM→TTS级联延迟；关键指标：理解+生成260ms，首包语音生成100ms内，打断响应率99%，多模态任务规划准确率95.55%，工具调用准确率94.25%，异构部署推理成本降低50%。 — [[2026-01-14-理想同学mindgpt-4o-audio实时语音对话大模型发布]]
- MindGPT 3.0千亿参数MoE模型通过三阶段后训练（长推理模仿学习→ASPO自适应强化学习→价值观对齐）实现深度推理；结构化Markdown思维链在内部GSB评估中优于业界主流推理模型；LisaRT引擎P-D分离使高并发Decode速度提升3倍，DP+TP+EP混合并行使服务吞吐提升3.3倍，MoE算子（CUTLASS GroupedGemm定制化）性能提升2.8倍。 — [[2026-01-14-理想同学mindgpt-3-0发布-基于结构化思维链的深度思考模型]]
