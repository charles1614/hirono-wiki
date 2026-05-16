---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 3
---

# LLM Open Source Ecosystem

## What

Community-driven landscape of open source projects for large language model development, covering frameworks, tools, and trends tracked via GitHub activity metrics

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- Ant Group's v2.0 landscape (114 projects, OpenRank ≥ 50 threshold, Aug 2025): AI Coding, Model Serving, LLMOps show growth; Agent Framework and AI Data show decline — [[LangGraph]], [[LlamaIndex]], AutoGen community investment "significantly contracted." Developer geography: US 37.4%, China 18.7%; US+China >60% in AI Infra; China more competitive in AI Agent (24.6% vs US 21.5%). Python dominates infra; TypeScript dominates application layer. — [[2025-09-17-从社区数据出发-再看大模型开源开发生态全景与趋势]]
- [[DeepMind]]的google-deepmind/deepmind-research仓库汇集60+研究论文配套实现（AlphaFold/Perceiver IO/MeshGraphNets等），覆盖RL/蛋白质折叠/图神经网络/科学ML等多领域，是多年积累的非生产级参考实现库，标注"not an official Google product"。 — [[2025-06-04-google-deepmind-deepmind-research-this-r]]
- gpt-oss-20B and gpt-oss-120B (OpenAI, Aug 2025): first open-weight models from OpenAI since GPT-2 in 2019; Apache 2.0 license allows distillation and commercial use; classified as "open-weight" (weights + inference code, no training data or training code) by OpenAI's own announcement; 2.1M H100-hours training compute (SFT + RL included); gpt-oss-120B matches Qwen3-235B on reasoning benchmarks despite being ~half the parameter count. — [[2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch]]

## Sources drawn on

- [[2025-09-17-从社区数据出发-再看大模型开源开发生态全景与趋势]] — Ant Group v2.0 LLM landscape analysis with OpenRank community data.
