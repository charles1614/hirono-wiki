---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 10
tier: active
---

# Moonshot AI

Chinese AI lab that developed the Kimi K2 / K2.5 / K2.6 1T open-weights MoE model family.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Moonshot AI 的 AI Infra 团队在推理延迟优化方面将"latency bound 算子"作为核心约束：认为 topk、小矩阵 gemm 在小 batch decode 场景下无法靠新硬件（Blackwell）或增加并行度解决，只能靠 IO fusion、算子 overlap 或开销摊薄来处理——这一认知直接驱动了 [[Attention Residual]] Block AttnRes 的 two-phase computation 设计。 — [[2026-03-21-https-zhuanlan-zhihu-com-p-2017528295286]]
- Kimi K2.5 deployed on Cloudflare Workers AI as the launch model for Cloudflare's frontier inference tier; used internally at Cloudflare for agentic coding (OpenCode) and automated security review at production scale. — [[2026-03-24-powering-the-agents-workers-ai-now-runs-]]
- Founder 杨植麟 at AGI-Next summit (Jan 2026): "做模型，本质上是在创造一种世界观"；positioned Moonshot AI's work on long-context and reasoning (Kimi lineage) as a considered bet on model philosophy, not just capability metrics. — [[2026-01-10-姚顺雨对着唐杰杨植麟林俊旸贴大脸开讲-基模四杰中关村论英雄]]
- Seer system (Moonshot AI + Tsinghua, arXiv:2511.14617): synchronous RL rollout optimization via divided rollout, context-aware length scheduling, and adaptive grouped speculative sampling using Compressed Suffix Trees across sibling responses; achieves 74–97% throughput improvement and 75–93% tail-latency reduction vs VeRL on production workloads including [[Kimi K2]] (DP32/EP32). — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]
