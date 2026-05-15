---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 1
---

# RL Post-Training

## What

Using reinforcement learning to align or refine a pretrained LLM: the policy generates rollouts, a reward model scores them, and a policy-gradient algorithm (PPO, GRPO, GSPO, REINFORCE++) updates the weights. Covers algorithms, infrastructure, and production-scale frameworks.

## Current understanding

The dominant production pattern (as of early 2026) connects a distributed training backend ([[Megatron-LM]] or [[PyTorch]] FSDP) with an inference engine ([[SGLang]] or [[vLLM]]) through an orchestration layer ([[Ray]]). [[slime]] ([[THUDM]]) is the production-proven example: it has been used to train GLM-5, GLM-4.x, Qwen3, DeepSeek V3, and Llama 3 series. Its architecture enforces strict process isolation — training never imports SGLang; inference never imports Megatron — with Ray actors as the bridge and the Ray object store for zero-copy data transfer.

**Algorithm choice** controls the advantage estimator. [[PPO]] requires a critic (value network) for advantage estimation; [[GRPO]] drops the critic and normalizes advantages across a group of samples from the same prompt; [[GSPO]] operates at the sequence level. In slime these are selectable via `--advantage-estimator`. Async training modes introduce controlled off-policy training; mitigations include importance sampling (`--use-tis`) and off-policy sequence masking (`--use-opsm`).

**Resource allocation** is the central tradeoff: colocated mode time-slices training and inference on shared GPUs (fewer GPUs; offloading latency; incompatible with async pipelining), while dedicated mode gives each subsystem its own GPU pool (higher throughput; more GPUs). Async pipelining (overlapping next rollout generation with current training) requires dedicated mode and explicit synchronization barriers before weight updates.

**Fault tolerance** at production scale requires health monitoring of inference engines and automatic replacement of failed instances without stopping the training run — slime implements this via periodic `/health_generate` checks. Long-running RL campaigns on large clusters depend on this more than pretraining does because the generate→train→update cycle creates additional failure surfaces (inference engine OOM, reward model timeout, etc.).

## Open threads

## Sources drawn on

_(populated as Sources wikilink this Topic; cite each with one-line relevance.)_
