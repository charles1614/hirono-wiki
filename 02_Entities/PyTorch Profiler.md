---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 8
tier: active
---

# PyTorch Profiler

PyTorch's built-in performance profiler; traces Python stack + CUDA events; limited under subprocesses.

## Synthesis



PyTorch Profiler is the framework-native CPU+GPU tracing and memory-analysis toolchain, accessible via context-manager or HTTP control plane and integrating with Nsight Systems via the auto-annotation path (`--pytorch=autograd-nvtx`). SGLang exposes profiler control via HTTP `/start_profile` and `/stop_profile` endpoints, generating per-rank traces named `{prefix}-{id}-TP{tp}-DP{dp}-PP{pp}-EP{ep}.trace.json.gz` with `merge_profiles: true` auto-merging across ranks — enabling interactive profiling without server restart and aligned trace capture against specific workload phases. Profiler output can be merged with Nsight Systems traces for two-layer analysis: Python-layer call comparison (suited to LLM-assisted code-level diffing) plus CUDA kernel-layer comparison via Nsight (which requires human expertise to read), as in the SGLang Diffusion Qwen-Image-Edit-2511 case where this two-layer workflow located three kernel-level regressions. The memory snapshot API (`torch.cuda.memory._record_memory_history` + `_dump_snapshot`) records complete CUDA segment allocation/release history with Python/C++ call stacks to a `.pkl` file consumable by pytorch.org/memory_viz; segment lifecycle differs from raw `cudaFree` because the torch allocator caches segments until `empty_cache()` is called explicitly. PyTorch 2.1's `export_memory_timeline` adds labeled zones (parameter, optimizer_state, input, temporary, activation, gradient, autograd_detail) — more readable than raw snapshots but less granular, and requiring a warm-up iteration before the measured run to avoid incorrect data.



## Observations

- SGLang exposes PyTorch Profiler control via HTTP API (`/start_profile`, `/stop_profile`), generating per-rank trace files in `{prefix}-{id}-TP{tp}-DP{dp}-PP{pp}-EP{ep}.trace.json.gz` format; `merge_profiles: true` auto-merges all ranks. Enables interactive profiling without server restart for workload-aligned trace capture. — [[2026-02-10-sglang-server交互式profiling的一些技巧-pytorch-n]]
- PyTorch Profiler数据可与Nsight Systems profile结果合并分析，适用于同时追踪Python层调用和CUDA kernel层耗时；在SGLang diffusion案例中，先用Cursor/AI做模型实现层代码对比，再用Nsight Systems做kernel层对比，两层分析互补覆盖不同粒度的性能问题。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
- PyTorch memory snapshot（`torch.cuda.memory._record_memory_history`）记录 CUDA 显存 segment 完整分配/释放历史为 `.pkl` 文件；显存管理分两层：Segment（向 CUDA driver 申请的连续显存块）和张量，`del` 触发 GC 但 Segment 被 cache 保留，`torch.cuda.empty_cache()` 才真正归还；堆栈信息可精确定位每次 `segment_alloc` 的调用来源（文件/行号/函数）。 — [[2025-09-22-如何利用pytorch-memory-snapshot进行显存分析]]

- PyTorch 2.1 Profiler `export_memory_timeline` provides labeled memory zones (parameter, optimizer_state, input, temporary, activation, gradient, autograd_detail) — more readable than raw Snapshot but less granular; requires a warm-up iteration before the measured run to avoid incorrect data. — [[2025-11-12-pytorch显存可视化与snapshot数据分析]]
