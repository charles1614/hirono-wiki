---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# verl

Open-source RL training framework for LLMs (used for post-training)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- 姜富春 published "verl源码解读&实操笔记" (2026-03-29), described as a clear source-code walkthrough recommended for those who haven't read the verl codebase. — [[2026-03-29-周末到-看看最近的论文和技术博客-充充电-小红书]]
- Seer (Moonshot AI) uses VeRL as its baseline for synchronous RL training performance comparison; on production workloads (Qwen2-VL-72B, Kimi K2), Seer achieves 74–97% throughput improvement and 75–93% tail-latency reduction vs VeRL's synchronous rollout. — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]
- verl v0.4.1 integrated [[Nsight Systems]] for Ray-based RL profiling: injected via RayActor `runtime_env`, with NVTX markers on step/gen/reward/old_log_prob/ref/values/adv/update_critic/update_actor/testing; three fine-grained capture controls: per training step via `torch.cuda.profiler.start/stop`, per worker rank, per subtask. Controller process prints hostname+PID for locating its trace file in the non-configurable `/tmp/ray/` path. — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
