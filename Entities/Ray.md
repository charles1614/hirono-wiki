---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 15
tier: active
---

# Ray

open-source distributed computing framework; provides actor model + placement groups + object store; used for ML cluster orchestration

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Daft's Ray Runner (Flotilla) uses a one-actor-per-node model: each `RaySwordfishActor` runs the full Swordfish streaming engine locally; a Rust-based `DistributedPhysicalPlanRunner` on the head node handles task scheduling and shuffle coordination with no Python GIL contention; named actors (`get_if_exists=True`) enable reuse across queries in the same job, amortizing 1–5 second creation cost. — [[2026-02-02-deepwiki-daft-06-ray-runner]]
- slime uses Ray as its distributed orchestration backbone: placement groups partition all cluster GPUs into actor/critic/rollout segments with deterministic ordering; Ray actors manage lifecycle of both training processes (`RayTrainGroup`) and inference engines (`SGLangEngine`); the Ray object store transfers rollout data between subsystems via object references, avoiding serialization overhead and enabling zero-copy when processes share a node. `RayTrainGroup` allocates 0.4 GPUs per actor to enable co-scheduling with inference when colocated. — [[2026-02-28-deepwiki-slime-01-overview]]
- Session #37 at PyTorch Conference 2025 (Robert Nishihara, Anyscale) presented an open-source post-training stack combining Kubernetes + Ray + [[PyTorch]] + [[vLLM]], and session #4 keynote framed Ray as "A Distributed Compute Engine for AI." — [[2025-12-14-vllm-project-vllm-in-pytorch-conference-]]
- `ray symmetric-run` (new command) runs the same entry-point on every cluster node simultaneously, auto-determining head/worker role and handling Ray lifecycle; enables MPI/`mpssh`-style one-command multi-node vLLM deployments without the traditional four-step head+worker+job+stop sequence. Ray was recently donated to the PyTorch Foundation. — [[2025-11-27-ray-symmetric-run-让-vllm-多节点部署更轻盈]]
- Ray-based RL profiling challenge: `nsys <app>` cannot profile actual compute in Ray programs since the `app` argument is merely a submit command; real compute runs in remote worker processes. The solution is injecting `runtime_env={"nsight": {...}}` at RayActor construction time (either in class definition or instance `.options()`). verl v0.4.1 added this integration with per-step, per-rank, and per-subtask capture-range control; output files in `/tmp/ray/session_*/logs/` (path not configurable). — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
- Ray's object store has a known scaling limitation for large-file transfers in GPU RL pipelines: the transparent data-movement mechanism ("越俎代庖") is problematic when [[verl]] Actors transfer large payloads (video/image) — Ray lacks RDMA, causing performance issues vs. scratchpad-managed AI chip memory. Oneflow team's analysis (2022) first characterized this as the "scratchpad vs. cache" tradeoff in AI accelerator memory management. — [[2025-05-30-https-zhuanlan-zhihu-com-p-1911558458903]]
- Ray provides the Actor model enabling multi-model RLHF orchestration (Actor/Rollout/Ref/Critic/Reward) in [[verl]] and [[OpenRLHF]]: `@ray.remote` gives each module independent resources and async execution; placement-group bundles allow up to 5 modules per GPU (num_gpus_per_actor=0.2); the Object Store transfers data between modules via references, avoiding explicit serialization. — [[2025-05-27-基于-ray-的分离式架构-verl-openrlhf-工程设计]]
