---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# PPO

Proximal Policy Optimization; cited in Insight 9 as the RL algorithm by which two interacting LLM agents update their policies, enabling opponent-shaping behavior.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- One of slime's supported `--advantage-estimator` values; slime's default loss type is `policy_loss` with PPO-style clipping (`--eps-clip`, `--eps-clip-high`) and KL divergence penalties (`--kl-coef`, `--kl-loss-coef`). Critic model (value network for advantage estimation) is optional via `--use-critic`. — [[2026-02-28-deepwiki-slime-01-overview]]
