---
created: 2026-05-15
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 17
tier: active
---

# verl

Open-source RL training framework for LLMs (used for post-training)

## Synthesis



verl is the dominant Ray-based RLHF training framework, inheriting its single-controller architecture directly from Pathways (MLSys 2022) — a master Python process manages the full RLHF computation graph with each node executing as a multi-GPU SPMD program, using Ray Actors as the open-source equivalent of Pathways' sharded dataflow nodes (a design that, ironically, the Pathways authors did not anticipate would serve RLHF rather than PP/MoE). verl uses Ray placement-group bundles for multi-model orchestration (Actor/Rollout/Ref/Critic/Reward), with the Hybrid Engine sharing a GPU pool between training (FSDP/Megatron) and generation (vLLM) via in-place resharding to avoid weight-copy costs. verl v0.4.1 integrated Nsight Systems for Ray-based profiling: `runtime_env={"nsight": {...}}` at RayActor construction works around the `nsys <app>` submit-command limitation, with NVTX markers on step/gen/reward/old_log_prob/ref/values/adv/update_critic/update_actor/testing and three capture controls (per training step via `torch.cuda.profiler.start/stop`, per worker rank, per subtask) outputting to the non-configurable `/tmp/ray/` path. NVIDIA's GRPO performance recipe on verl documents a ~501s per-step decomposition (Rollout 205.7s as the largest bottleneck at ~41%, old_log_prob 85.2s, reference 80.6s, actor update 126.1s); dynamic batch size plus sequence packing raises MFU from 30.3% to 45.96%, CUDA Graph for rollout (off by default in verl+vLLM) adds 17% E2E at Qwen2-7B and 2× at Qwen3-30B, and async DAPO (PR #2799) addresses long-tail GPU idling for 20–40% throughput gain. Seer (Moonshot AI) uses verl as its synchronous-RL baseline, reporting 74–97% throughput improvement and 75–93% tail-latency reduction.



## Observations

- 姜富春 published "verl源码解读&实操笔记" (2026-03-29), described as a clear source-code walkthrough recommended for those who haven't read the verl codebase. — [[2026-03-29-周末到-看看最近的论文和技术博客-充充电-小红书]]
- Seer (Moonshot AI) uses VeRL as its baseline for synchronous RL training performance comparison; on production workloads (Qwen2-VL-72B, Kimi K2), Seer achieves 74–97% throughput improvement and 75–93% tail-latency reduction vs VeRL's synchronous rollout. — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]
- verl v0.4.1 integrated [[Nsight Systems]] for Ray-based RL profiling: injected via RayActor `runtime_env`, with NVTX markers on step/gen/reward/old_log_prob/ref/values/adv/update_critic/update_actor/testing; three fine-grained capture controls: per training step via `torch.cuda.profiler.start/stop`, per worker rank, per subtask. Controller process prints hostname+PID for locating its trace file in the non-configurable `/tmp/ray/` path. — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
- verl's single-controller design directly inherits Pathways (MLSys 2022)'s architecture: a master Python process manages the full RLHF computation graph, with each graph node executing as a multi-GPU SPMD program. Pathways' authors (including Yonghui Wu, now ByteDance Seed lead) did not anticipate RLHF multi-model graphs as the primary MPMD use case — they predicted PP/MoE — but the design turned out to be prescient for RL training. [[Ray]] Actors serve as the open-source equivalent of Pathways' sharded dataflow nodes. — [[2025-05-30-https-zhuanlan-zhihu-com-p-1911558458903]]
- Covered extensively in Awesome-ML-SYS-Tutorial with multi-part source-code walkthroughs (initialization, rollout, make-experience phases), AgentLoop multi-turn analysis, tokenization and masking for multi-turn training, DAPO dynamic filtering, profiling guide, and a parameter quick reference; also covers SGLang-verl server-based rollout interface and HybridFlow paper analysis. — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
- verl uses [[Ray]] Actor abstraction with placement-group bundles for multi-model RLHF (Actor/Rollout/Ref/Critic/Reward); Hybrid Engine shares GPU pool between training (FSDP/Megatron) and generation ([[vLLM]]) via in-place resharding, avoiding weight copy costs of separate-pool designs; SPMD is used for worker execution with no central controller at runtime. — [[2025-05-27-从零开始的verl框架解析]]
- [[OpenRLHF]] (v0.5.9.post1) and [[verl]] both use Ray placement-group bundles with `num_gpus_per_actor=0.2` for up to 5-module colocate on one GPU; Actor↔Rollout colocate requires CUDA IPC for weight sync since NCCL cannot communicate between two processes on the same GPU. — [[2025-05-27-基于-ray-的分离式架构-verl-openrlhf-工程设计]]
- NVIDIA GRPO training performance recipe in verl: a full step totals ~501s (Rollout 205.7s, old_log_prob 85.2s, reference 80.6s, actor update 126.1s); dynamic batch size (`use_dynamic_bsz=True`) + sequence packing raises MFU from 30.3% to 45.96% on Qwen2.5 7B; CUDA Graph for rollout (off by default in verl+vLLM) adds 17% E2E speedup at Qwen2-7B / response=512, 2× speedup at Qwen3-30B / prompt=2048 / response=8192; async DAPO (`verl/pull/2799`) addresses long-tail GPU idling (20–40% throughput gain). — [[2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔]]
