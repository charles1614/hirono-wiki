---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 6
tier: active
---

# GRPO

Group Relative Policy Optimization; RL algorithm variant; reward-normalized advantage estimation without a critic

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Listed as one of slime's supported `--advantage-estimator` values alongside GSPO, PPO, REINFORCE++, and REINFORCE++ baseline. Slime also supports dynamic sampling filters that accept only samples where rewards have nonzero variance across a prompt group (as in DAPO). — [[2026-02-28-deepwiki-slime-01-overview]]
- ROLL Flash integrates GRPO and other off-policy algorithms (Decoupled PPO, TOPR, TIS, CISPO) to compensate for staleness from async training (asynchronous ratio α≤2); experiments show even plain GRPO sufficiently mitigates stale-sample degradation, preserving synchronous-training-equivalent final performance. — [[2025-11-10-3a大作-阿里roll团队从基建-算法-机理-推动rl4llm全栈协同优化]]
- Listed as a supported algorithm in the [[slime]] RL framework (`--advantage-estimator grpo`) alongside GSPO, PPO, REINFORCE++, and on-policy distillation; also listed in Awesome-ML-SYS-Tutorial's SGLang section (GRPO trainer with SGLang as inference backend). — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
- In a complete GRPO pipeline using verl: Rollout generation is the largest bottleneck at ~41% of total step time (205.7s of 501s); all three non-rollout phases (old_log_prob, reference, actor update) are each 80–126s; sequence packing + dynamic batching are the highest-leverage training-side optimizations, raising MFU from 30.3% to 45.96%. — [[2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔]]
- Composer 2 (Cursor) modifies GRPO by removing length standardization (introduces length bias) and not normalizing group advantages by std deviation (causes degenerate upweighting when all rollouts achieve identical correctness); uses k1 = -log r KL estimator instead of the common k3 = (r-1) - log r because k3 variance blows up as p and q diverge. — [[2026-03-26-composer]]
