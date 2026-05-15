---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# ROLL

Alibaba's RL training framework for LLMs featuring async training (ROLL Flash), AsyPPO, and attention-based reward

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- ROLL Flash, the async training component of ROLL, achieves 2.72× Agentic (ALFWorld) and 2.24× RLVR (math) throughput vs synchronous baseline via per-prompt queue scheduling, prompt replication, environment-level async rollout, and redundant environment deployment; near-linear scaling at 100+ GPUs (7.6× at 8× GPU count); companion ROCK provides sandbox management. Open-sourced at github.com/alibaba/ROLL. — [[2025-11-10-3a大作-阿里roll团队从基建-算法-机理-推动rl4llm全栈协同优化]]
