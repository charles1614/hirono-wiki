---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/zhaochenyang20/Awesome-ML-SYS-Tutorial
tags: [post-training, inference, parallelism, tooling]
---

# [2025-07-03] Awesome-ML-SYS-Tutorial: Learning Notes for ML Systems

## TL;DR

A curated, growing collection of learning notes and code walkthroughs for ML systems infrastructure, authored by Zhao Chenyang (now at RadixArk), covering RL infra frameworks (slime, verl, AReaL, OpenRLHF), SGLang internals, distributed training, and GPU fundamentals. The repo grew from ~30 stars in August 2024 to over 4.5K stars within a year.

## Key claims

- The author's motivation is rigorous RL infrastructure: conclusions drawn from flawed RL infra (common in open-source and company settings) may be incorrect, and he questions paper conclusions that rely on such infra.
- Coverage spans four major RL frameworks: [[slime]] (multi-turn, INT4 QAT, speculative decoding, FSDP2 backend), [[verl]] (multi-turn rollout, AgentLoop, tokenization/masking, DAPO), [[AReaL]] (async RL walkthrough), and [[OpenRLHF]] (SGLang integration).
- [[SGLang]] notes include scheduler deep-dives, KV cache management, diffusion LLM support (LLaDA 2.0), quantization architecture, constraint decoding, DP Attention for [[MLA]] models, and weight update latency optimization.
- Distributed training content covers FSDP, Megatron, tensor parallelism, NCCL topology, PyTorch DDP, and CUDA Graph optimizations.
- The author's thesis: RL strengthens熟练度 (proficiency/skill) but cannot exceed the ceiling of the base model — RL requires at least one correct output trajectory to reinforce.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[slime]], [[verl]], [[AReaL]], [[OpenRLHF]], [[SGLang]], [[MLA]], [[GRPO]], [[FSDP]]

## Topics touched

[[RL Post-Training]], [[LLM Training Systems]], [[LLM Inference Systems]], [[Parallelism Strategies]]

## Raw source

[github.com/zhaochenyang20/Awesome-ML-SYS-Tutorial](https://github.com/zhaochenyang20/Awesome-ML-SYS-Tutorial) — GitHub README / living blog index by Zhao Chenyang, updated through July 2025. Read 2026-05-16.
