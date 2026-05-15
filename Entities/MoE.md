---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 16
tier: active
---

# MoE

Mixture-of-Experts; sparse-activation architecture; current frontier-model default (DeepSeek-V3, GPT-OSS, GLM-4.6, Mixtral).

## Synthesis

*Regenerated from Observations below.*

## Observations

- **Shared Experts Fusion** for models with a single shared expert (e.g., GLM-4.7): merging the shared expert into the routed MoE structure — selecting top-(k+1) of (N+1) experts rather than top-k routed + shared-separately — eliminates a second dispatch and produces substantial SM utilization gains when the intermediate size is small under TP+FP8 configurations. — [[2026-01-26-optimizing-glm4-moe-for-production-65-fa]]
- **EPLB (Expert Parallelism Load Balancer) is the dominant single optimization lever at large EP scale**: in SGLang's 96-GPU DeepSeek-V3 deployment, EPLB delivers 1.49× prefill and 2.54× decode speedup over unbalanced EP. EPLB works by allocating 32 redundant experts (288 total from 256) and using them as flexibility budget — replicating hot experts, grouping cold experts together, and enabling non-power-of-2 EP sizes (EP12, EP72). Without EPLB, GPU balancedness (mean/max token count ratio) degrades sharply as EP size grows. — [[2025-09-05-deploying-deepseek-with-pd-disaggregatio]]
- Raschka's 2025–2026 survey documents MoE as the dominant paradigm for frontier models above ~30B parameters. DeepSeek V3's architecture (256 experts, 9 active / 37B of 671B) became the 2025 reference, adopted directly by [[Kimi K2]] and [[Mistral Small]] 3 Large. Shared-expert presence is a live design variable: used in DeepSeek V3, GLM-4.5, Grok 2.5, and Qwen3-Next; dropped in Qwen3 235B-A22B and MiniMax M2. Qwen3 developer noted no significant improvement from shared experts in their setup (8+ routed experts). — [[2026-01-28-the-big-llm-architecture-comparison]]
- **GLM 5与DeepSeek V3.2的MoE配置相同**：独立专家+共享专家，单token仅路由至8个独立专家（top-8路由）。GLM 5（774B总参/40B激活）与DeepSeek V3.2（671B总参/37B激活）的主要差异不在MoE路由方案，而在总参规模与激活参数数量。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
