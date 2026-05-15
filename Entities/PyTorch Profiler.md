---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# PyTorch Profiler

PyTorch's built-in performance profiler; traces Python stack + CUDA events; limited under subprocesses.

## Synthesis

*Regenerated from Observations below.*

## Observations

- SGLang exposes PyTorch Profiler control via HTTP API (`/start_profile`, `/stop_profile`), generating per-rank trace files in `{prefix}-{id}-TP{tp}-DP{dp}-PP{pp}-EP{ep}.trace.json.gz` format; `merge_profiles: true` auto-merges all ranks. Enables interactive profiling without server restart for workload-aligned trace capture. — [[2026-02-10-sglang-server交互式profiling的一些技巧-pytorch-n]]
- PyTorch Profiler数据可与Nsight Systems profile结果合并分析，适用于同时追踪Python层调用和CUDA kernel层耗时；在SGLang diffusion案例中，先用Cursor/AI做模型实现层代码对比，再用Nsight Systems做kernel层对比，两层分析互补覆盖不同粒度的性能问题。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
