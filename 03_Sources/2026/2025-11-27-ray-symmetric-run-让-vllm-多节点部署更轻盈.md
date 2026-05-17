---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/1cZtyTDr97qLZ40VfOQ5xw
tags: [inference, parallelism, production-deployment, tooling]
---

# [2025-11-26] Ray symmetric-run：让 vLLM 多节点部署更轻盈

## TL;DR

Ray added `ray symmetric-run`, a command that launches the same entry-point on every node in a cluster simultaneously, handling Ray head/worker lifecycle automatically. This enables MPI-style or `mpssh`-style multi-node vLLM deployments without manually managing `ray start`/`ray stop` across nodes.

## Key claims

- Traditional Ray multi-node workflow requires: (1) `ray start --block` on head, (2) `ray start --block --address=ip:6379` on workers, (3) submit job on head, (4) `ray stop` on all nodes — four distinct steps prone to environment-variable misconfiguration.
- `ray symmetric-run` collapses this to a single identical command run on all nodes; the command auto-determines head vs. worker role and handles Ray start/stop internally.
- Usage: `ray symmetric-run --address <head>:6379 --min-nodes 2 --num-gpus 8 -- vllm serve <model> --tensor-parallel-size 8 --pipeline-parallel-size 2`.
- Environment variables prefixed before the command are automatically injected into the Ray runtime.
- Ray was recently donated to the PyTorch Foundation; vLLM and Ray teams are aligning on next-gen AI infra.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[vLLM]], [[Ray]]

## Topics touched

[[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/1cZtyTDr97qLZ40VfOQ5xw](https://mp.weixin.qq.com/s/1cZtyTDr97qLZ40VfOQ5xw) — vLLM official WeChat blog; translation of https://blog.vllm.ai/2025/11/22/ray-symmetric-run.html; published 2025-11-26. Read 2026-05-15.
