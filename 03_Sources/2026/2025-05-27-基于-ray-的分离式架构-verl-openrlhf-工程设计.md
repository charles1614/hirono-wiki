---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/26833089345
tags: [rl-post-training, distributed-systems, source-shape/blog, llm-training]
---

# [2025-03-01] 基于Ray的分离式架构：veRL、OpenRLHF工程设计

## TL;DR

A comparative engineering analysis of [[verl]] and [[OpenRLHF]] as the two dominant Ray-based RLHF frameworks, examining how they assign module responsibilities, allocate GPU resources via placement groups, and implement data/control flow for PPO-family algorithms.

## Key claims

- [[Ray]] Actor abstraction suits multi-model RL (Actor/Rollout/Ref/Critic/Reward × train/eval/generate) because `@ray.remote` gives each module independent resource allocation, async execution, and Object Store-based data exchange — without central controllers required by SPMD.
- [[OpenRLHF]] uses DeepSpeed for training modules and [[vLLM]] for rollout; [[verl]] uses FSDP/Megatron for training and vLLM for generation, with a "Hybrid Engine" that shares GPUs between training and generation rather than maintaining separate pools.
- Colocate pattern: multiple Ray Actors share one GPU via placement-group bundles with `num_gpus_per_actor=0.2` (supports up to 5 modules per GPU). Actor↔Rollout colocate requires CUDA IPC for weight sync (NCCL cannot communicate between two processes on the same GPU).
- [[OpenRLHF]] control flow: all Actor workers simultaneously call `PPOTrainer.fit`; each Actor worker is round-robin bound to (Ref, Critic, RM) workers — heavy control/data burden on Actor workers.
- Training-inference logit precision divergence of ~10% relative error is a known issue; eval modules involving loss computation (Ref, Critic) prefer training engines (DeepSpeed/FSDP) over inference engines even when slower.
- [[verl]] resource allocation uses the same Ray placement-group strategy; its Hybrid Engine avoids weight copy between separate training/inference GPU pools by resharding in-place.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[verl]], [[OpenRLHF]], [[Ray]], [[vLLM]], [[SGLang]]

## Topics touched

[[RL Post-Training]], [[LLM Training Systems]], [[Parallelism Strategies]], [[Hybrid Parallelism]]

## Raw source

[zhuanlan.zhihu.com/p/26833089345](https://zhuanlan.zhihu.com/p/26833089345) — Zhihu article, author: 杨远航, published 2025-03-01. Read 2026-05-16.
