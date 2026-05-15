---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# AsyPPO

Asymmetric PPO variant using lightweight mini-critics instead of full-scale critics for stable LLM RL training

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- AsyPPO uses two small critics trained on non-overlapping prompt partitions; uncertainty-aware loss masking suppresses advantages when critics agree (low uncertainty) and removes high-uncertainty tokens from entropy regularization; achieves ~20s per-step speedup and removes one server node vs full-scale critic PPO while matching or exceeding GRPO baseline on AIME24/25 and AMC benchmarks. — [[2025-11-10-3a大作-阿里roll团队从基建-算法-机理-推动rl4llm全栈协同优化]]
