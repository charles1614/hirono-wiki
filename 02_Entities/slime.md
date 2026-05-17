---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 7
tier: active
---

# slime

THUDM RL post-training framework; connects Megatron-LM training with SGLang inference via Ray orchestration

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Production RL post-training framework used to train GLM-5, GLM-4.x, Qwen3, DeepSeek V3, and Llama 3 series models. Architecture: three-way separation between Megatron-LM training, SGLang inference, and Ray orchestration; processes are strictly isolated (training never imports SGLang, inference never imports Megatron). — [[2026-02-28-deepwiki-slime-01-overview]]
- Two operating modes: synchronous `train.py` (sequential generate→train→update; supports colocated GPUs + offloading) and async `train_async.py` (overlaps next rollout generation with current training; requires dedicated non-colocated GPUs; asserts `not args.colocate`). — [[2026-02-28-deepwiki-slime-01-overview]]
- Pluggable architecture: rollout function, reward model, loss function, data source, generate function, dynamic sampling filter, and buffer filter are all swappable via `--<plugin>-path` CLI flags without source modification. Supports GRPO, GSPO, PPO, REINFORCE++, and on-policy distillation (`--use-opd`). — [[2026-02-28-deepwiki-slime-01-overview]]
- Covered in Awesome-ML-SYS-Tutorial with articles on multi-turn RL for LLM/VLM, INT4 QAT RL end-to-end practice, speculative decoding in RL sampling (draft model updated during training), FSDP2 training backend, and FP8 unified precision for sampling and training. Source code walkthrough also available. — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
