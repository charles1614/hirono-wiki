---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/r7751Z6YPf169d1SVqmA_Q
tags: [post-training, observability, gpu, production-deployment]
---

# [2025-09-04] NVIDIA技术沙龙《强化学习流水线优化：性能分析与Rollout加速》演讲笔记

## TL;DR

Detailed notes from an NVIDIA technical salon on profiling and optimizing RL training pipelines (specifically verl + GRPO), covering Nsight Systems integration with Ray actors, actor training optimizations (sequence packing, dynamic batching, fused kernels), rollout optimization (CUDA Graph, chunked prefill, long-tail async DAPO), and concrete Qwen 2.5 7B / Qwen3 235B tuning recipes.

## Key claims

- A full GRPO training step on verl takes ~501s total: Rollout generation 205.7s, old_log_prob 85.2s, reference model 80.6s, reward + advantage + actor update 126.1s — Rollout is the dominant bottleneck at ~41%.
- Nsight Systems can profile Ray-distributed RL workers by setting `runtime_env={"nsight": "default"}` on `ray.remote` or `RayActor.options()`; verl exposes this via `actor_rollout_ref.profiler` / `critic.profiler` config; profile files land in `/tmp/ray/session_latest/logs/nsight/`.
- `DISCRETE=True` mode generates one nsys file per sub-phase (rollout, log_prob, reference, actor training) per worker; files are named `worker_process_{pid}.nsys-rep` with a `{1-4}` suffix for sub-phases, reducing file size for analysis.
- Sequence packing (removing padding by concatenating short sequences) is default in Megatron-LM and enabled by `use_remove_padding=True` in FSDP; dynamic batch size (`use_dynamic_bsz=True`) prevents OOM on long sequences and is strongly recommended; together they raise MFU from 30.3% to 45.96% on Qwen2.5 7B.
- CUDA Graph for rollout is OFF by default in verl+vLLM but ON by default in verl+SGLang; enabling it yields 17% end-to-end speedup for Qwen2-7B at response length 512, and 2× speedup for Qwen3-30B at prompt 2048 + response 8192.
- The long-tail problem: rank4's `generate_sequence` takes significantly less time than rank0, leaving rank4 waiting; solved by async DAPO (`verl/pull/2799`) using non-blocking concurrent requests, early stopping when target prompts complete (with reward variance check), and dynamic load balancing; speedup 20–40%.
- Qwen3 235B MoE SOTA config: 256 GPUs, TP=2, PP=8, EP=32, VP=4, global batch size 2048; per GPU memory 83.27GB for Qwen2.5 7B at seq_len=10240, TP=2 (3.81GB params + 27.57+51.36GB activation + 31.92GB optimizer state).

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔/weixin-img-004.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔/weixin-img-019.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔/weixin-img-020.png)

*Other images decorative (slides header/QR codes, additional timeline crops described in body).*

## Entities touched

[[verl]], [[Nsight Systems]], [[GRPO]], [[vLLM]], [[Ray]], [[Qwen]], [[CUDA Graph]], [[MoE]]

## Topics touched

[[RL Post-Training]], [[GPU Profiling]], [[MoE Training]], [[Parallelism Strategies]], [[LLM Training Systems]]

## Raw source

[mp.weixin.qq.com/s/r7751Z6YPf169d1SVqmA_Q](https://mp.weixin.qq.com/s/r7751Z6YPf169d1SVqmA_Q) — WeChat article by GiantPandaLLM, published 2025-09-04. Read 2026-05-16.
