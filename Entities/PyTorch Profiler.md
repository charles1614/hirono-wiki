---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# PyTorch Profiler

PyTorch's built-in performance profiler; traces Python stack + CUDA events; limited under subprocesses.

## Synthesis

*Regenerated from Observations below.*

## Observations

- SGLang exposes PyTorch Profiler control via HTTP API (`/start_profile`, `/stop_profile`), generating per-rank trace files in `{prefix}-{id}-TP{tp}-DP{dp}-PP{pp}-EP{ep}.trace.json.gz` format; `merge_profiles: true` auto-merges all ranks. Enables interactive profiling without server restart for workload-aligned trace capture. — [[2026-02-10-sglang-server交互式profiling的一些技巧-pytorch-n]]
- PyTorch Profiler数据可与Nsight Systems profile结果合并分析，适用于同时追踪Python层调用和CUDA kernel层耗时；在SGLang diffusion案例中，先用Cursor/AI做模型实现层代码对比，再用Nsight Systems做kernel层对比，两层分析互补覆盖不同粒度的性能问题。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
- PyTorch memory snapshot（`torch.cuda.memory._record_memory_history`）记录 CUDA 显存 segment 完整分配/释放历史为 `.pkl` 文件；显存管理分两层：Segment（向 CUDA driver 申请的连续显存块）和张量，`del` 触发 GC 但 Segment 被 cache 保留，`torch.cuda.empty_cache()` 才真正归还；堆栈信息可精确定位每次 `segment_alloc` 的调用来源（文件/行号/函数）。 — [[2025-09-22-如何利用pytorch-memory-snapshot进行显存分析]]

- PyTorch 2.1 Profiler `export_memory_timeline` provides labeled memory zones (parameter, optimizer_state, input, temporary, activation, gradient, autograd_detail) — more readable than raw Snapshot but less granular; requires a warm-up iteration before the measured run to avoid incorrect data. — [[2025-11-12-pytorch显存可视化与snapshot数据分析]]
