---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/slime?file=01-overview
tags: [post-training, training, parallelism, tooling]
---

# [2026-02-28] DeepWiki slime — 01 Overview and Core Concepts

## TL;DR

Architecture overview of **slime**, [[THUDM]]'s production RL post-training framework (used to train GLM-5, GLM-4.x, Qwen3, DeepSeek V3, Llama 3 series). Slime connects [[Megatron-LM]]-based distributed training with [[SGLang]]-powered inference through [[Ray]] orchestration, exposing two entry points: a synchronous `train.py` loop and a pipelined `train_async.py` that overlaps rollout generation with training for higher GPU utilization.

## Key claims

- **Two operating modes**: `train.py` (synchronous — each generate→train→update cycle is strictly sequential; supports colocated GPUs + memory offloading) and `train_async.py` (asynchronous — next rollout launches before current training step finishes; requires dedicated, non-colocated GPU allocations; asserts `not args.colocate`).
- **Three-subsystem separation** is the core architectural principle:

  | Subsystem | Responsibility | Technology |
  | --- | --- | --- |
  | Training | Gradient computation, parameter updates, checkpointing | Megatron-LM or FSDP |
  | Inference | Token generation, log-prob computation, reward evaluation | SGLang + Router |
  | Orchestration | Resource allocation, lifecycle management, data flow | Ray |

  Training processes never import SGLang directly; inference engines never import Megatron. Ray actors serve as the bridge.

- **SGLang-native inference**: SGLang engines are launched as Ray actors managed through a load-balancing router, communicating via HTTP APIs. Weight updates transfer trained parameters from Megatron directly into running SGLang instances without server restarts. Slime inherits RadixAttention (prefix caching), continuous batching, tensor parallelism, and memory management from SGLang with no reimplementation.
- **Pluggable design**: rollout function, reward model, loss function, data source, generate function, dynamic sampling filter, and buffer filter are all replaceable via `--<plugin>-path` CLI args — no source modification or subclassing required. Enables custom multi-turn environments, tool-calling workflows, and novel reward functions.
- **Fault tolerance** (`--use-fault-tolerance`): automatic health monitoring of SGLang engines via periodic `/health_generate` checks; unhealthy engines are detected, terminated, and replaced without stopping the training run.
- **Async pipelining constraint**: weight updates cannot overlap with generation — when `update_weights_interval` is reached, the loop explicitly synchronizes pending generation before calling `actor_model.update_weights()`. Introduces controlled off-policy training mitigated via `--use-tis` (importance sampling) or `--use-opsm` (off-policy sequence masking).
- **Colocated vs. dedicated GPU modes**: colocated (`--colocate`) time-slices training and inference on the same GPUs using CPU offloading between phases — fewer GPUs but adds offloading latency, incompatible with async. Dedicated (default) gives each subsystem its own allocation for simultaneous execution and higher throughput.
- **Supported RL algorithms** (via `--advantage-estimator`): [[GRPO]], [[GSPO]], [[PPO]], REINFORCE++, REINFORCE++ baseline. On-policy distillation (`--use-opd`) also supported.
- **Supported model families**: Qwen3 (dense + MoE), Qwen2.5, DeepSeek V3/R1, GLM-4/5 (dense + MoE), Llama 3.1/3.2, MIMO-7B, Moonlight-16B-A3B. Weight conversion dispatches via model-name pattern matching in `slime/backends/megatron_utils/megatron_to_hf/__init__.py`.
- **Configuration system** merges three namespaces — Megatron, SGLang, and SLIME-specific — via a multi-phase parser in `slime/utils/arguments.py`. A pre-parser identifies `--train-backend` and debug flags before the main parse; final args pass through `slime_validate_args()`, `megatron_validate_args()`, and `sglang_validate_args()` in sequence.
- **Ray placement groups** (`slime/ray/placement_group.py`) create a single group containing all GPUs, then partition into actor/critic/rollout segments. `RayTrainGroup` allocates 0.4 GPUs per actor to enable co-scheduling with inference on the same physical GPUs when colocated.
- **Data buffer** (`slime/rollout/data_source.py` → `RolloutDataSourceWithBuffer`): maintains a prompt dataset and an in-memory buffer of partially completed samples. Supports epoch-based iteration with optional shuffling and partial rollout (recycling incomplete generations back to the buffer).

## Visual observations

*No load-bearing images — source has no images; architecture is expressed entirely via mermaid diagrams (9 embedded code blocks) and tables in the raw archive.*

## What this changes

- Establishes slime as the production-proven RL post-training framework for frontier Chinese lab models (GLM-5, Qwen3, DeepSeek V3 cited explicitly), complementing the inference-side [[SGLang]] picture already in the corpus.
- The async pipelining + controlled off-policy design is the specific mechanism by which throughput improves — not free: requires dedicated GPU allocations and weight-update synchronization barriers. Contrasts with colocated mode which trades throughput for fewer GPUs.
- The three-subsystem separation with strict process isolation (training never imports SGLang, inference never imports Megatron) is a deliberate boundary choice that makes each subsystem independently upgradable — and is the prerequisite for the fault-tolerance model.

## Entities touched

[[slime]], [[THUDM]], [[Tsinghua]], [[SGLang]], [[Megatron-LM]], [[Ray]], [[GRPO]], [[GSPO]], [[PPO]], [[DeepSeek-R1]], [[DeepSeek]], [[Qwen]], [[Llama]], [[MoE]]

## Topics touched

[[LLM Training Systems]], [[RL Post-Training]]

## Raw source

[wiki.litenext.digital/wiki/slime?file=01-overview](https://wiki.litenext.digital/wiki/slime?file=01-overview) — DeepWiki page (generated 2026-02-25, source commit 7014942c) · 29 KB markdown · 9 mermaid diagrams, 23 tables, 17 code fences · fetched 2026-05-10.
