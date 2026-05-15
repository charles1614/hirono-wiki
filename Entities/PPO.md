---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# PPO

Proximal Policy Optimization; cited in Insight 9 as the RL algorithm by which two interacting LLM agents update their policies, enabling opponent-shaping behavior.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- One of slime's supported `--advantage-estimator` values; slime's default loss type is `policy_loss` with PPO-style clipping (`--eps-clip`, `--eps-clip-high`) and KL divergence penalties (`--kl-coef`, `--kl-loss-coef`). Critic model (value network for advantage estimation) is optional via `--use-critic`. — [[2026-02-28-deepwiki-slime-01-overview]]
- [[EasyDistill]] 集成 PPO 和 GRPO 算法，用于 AI 反馈强化学习路线（支持训练奖励模型，解决学生模型单纯模仿教师导致的过拟合问题），是 DistilQwen2.5-R1 等 System 2 模型蒸馏的核心组件之一。 — [[2026-01-15-知识蒸馏不再难-阿里开源easydistill及distilqwen模型家族-开]]
- 地平线RAD在RL后训练阶段用PPO优化policy，与IL混合训练（RL:IL数据比4:1最优）；辅助任务（减速/加速/左转/右转）仅用GAE作为loss_weight，消融实验显示即使没有PPO全套loss也能改进碰撞率指标，说明辅助任务的核心价值在于引导特定行为方向而非算法复杂度。 — [[2025-12-25-地平线rad-基于3dgs-大规模强化学习的端到端驾驶策略]]
