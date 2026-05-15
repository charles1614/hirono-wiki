---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# PyTorch Profiler

PyTorch's built-in performance profiler; traces Python stack + CUDA events; limited under subprocesses.

## Synthesis

*Regenerated from Observations below.*

## Observations

- SGLang exposes PyTorch Profiler control via HTTP API (`/start_profile`, `/stop_profile`), generating per-rank trace files in `{prefix}-{id}-TP{tp}-DP{dp}-PP{pp}-EP{ep}.trace.json.gz` format; `merge_profiles: true` auto-merges all ranks. Enables interactive profiling without server restart for workload-aligned trace capture. — [[2026-02-10-sglang-server交互式profiling的一些技巧-pytorch-n]]
