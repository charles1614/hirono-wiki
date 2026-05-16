---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 6
tier: active
---

# OpenRLHF

Open-source RLHF framework for LLM post-training

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Covered in Awesome-ML-SYS-Tutorial with articles on integrating [[SGLang]] into OpenRLHF as an inference backend and a brief analysis of the computational flow of post-training systems using OpenRLHF as the reference; also links to Ms. Mengyuan's illustrated PPO series using OpenRLHF. — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
- Engineering deep-dive (v0.5.9.post1): control logic in `PPOTrainer.fit` is owned by Actor workers; each Actor worker is round-robin bound to a (Ref, Critic, RM) group; `PPORayActorGroup` in `launcher.py` creates rank-0 worker first to obtain NCCL addr/port, then creates remaining workers; supports `colocate_actor_ref`, `colocate_critic_reward`, `colocate_all_models`. Rollout uses [[vLLM]] with DP+TP parallelism. — [[2025-05-27-基于-ray-的分离式架构-verl-openrlhf-工程设计]]
