---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# GRPO

Group Relative Policy Optimization; RL algorithm variant; reward-normalized advantage estimation without a critic

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Listed as one of slime's supported `--advantage-estimator` values alongside GSPO, PPO, REINFORCE++, and REINFORCE++ baseline. Slime also supports dynamic sampling filters that accept only samples where rewards have nonzero variance across a prompt group (as in DAPO). — [[2026-02-28-deepwiki-slime-01-overview]]
- ROLL Flash integrates GRPO and other off-policy algorithms (Decoupled PPO, TOPR, TIS, CISPO) to compensate for staleness from async training (asynchronous ratio α≤2); experiments show even plain GRPO sufficiently mitigates stale-sample degradation, preserving synchronous-training-equivalent final performance. — [[2025-11-10-3a大作-阿里roll团队从基建-算法-机理-推动rl4llm全栈协同优化]]
