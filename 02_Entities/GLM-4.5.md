---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# GLM-4.5

Zhipu AI's GLM series MoE model (355B and Air 106B variants), with GLM-5 at 744B and GLM-5.1 as frontier entries.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- **GLM-4.7 production serving profile** on H200: 160 routed + 1 shared expert (161 total), top-8 routing per token, 92 transformer layers, TP8 FP8. Under this configuration, the intermediate size of 192 is small enough that fusing the shared expert into the routed MoE structure (+1 to top-k) yields 23.7% TTFT / 20.8% ITL gains by boosting SM utilization. Without CUDA Graph, 92-layer kernel launch overhead alone can consume hundreds of ms to >1 s of TTFT. — [[2026-01-26-optimizing-glm4-moe-for-production-65-fa]]
- GLM-4.5 (355B) uses DeepSeek V3's pattern of 3 dense prefix layers before MoE blocks (for early-layer stability), retains [[MLA]] and a shared expert, and adds attention-bias logits similar to GPT-OSS. GLM-5 (744B, 40B active) extends this by adopting DeepSeek Sparse Attention for long-context efficiency; Raschka benchmarks GLM-5 as on par with GPT-5.2, Gemini Pro 3, and Claude 4.6 Opus. — [[2026-01-28-the-big-llm-architecture-comparison]]
- **GLM 5的完整参数配置**（kaiyuan对比，2026-03-21）：总参774B，激活40B；前3层Dense，其余MoE；支持200k上下文；Slime框架训练。MLA与Indexer参数与DeepSeek V3.2完全相同（见[[GLM 5]]实体）。SWE-bench-Verified 77.8，Terminal Bench 2.0 56.2，超越Gemini 3.0 Pro。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
