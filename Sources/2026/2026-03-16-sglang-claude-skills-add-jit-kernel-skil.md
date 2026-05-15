---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/sgl-project/sglang/blob/main/.claude/skills/add-jit-kernel/SKILL.md
tags: [inference, gpu, tooling]
---

# [2026-03-16] SGLang Add-JIT-Kernel SKILL

## TL;DR

In-tree Claude Code SKILL document (`sglang/.claude/skills/add-jit-kernel/SKILL.md`) that teaches a coding agent how to add a first-use-compiled JIT kernel to SGLang from scratch. Covers the full five-step workflow — CUDA kernel in `.cuh`, Python wrapper, optional build-flag tuning, CI-registered pytest, and Triton-benchmarked `bench_*.py` — plus a rich catalogue of project-specific abstractions (`TensorMatcher`, `AlignedVector`, `LaunchKernel`, `tile::Memory`, PDL, persistent-kernel pattern) that agent-written kernels must use instead of raw CUDA primitives.

## Key claims

- **JIT vs AOT decision rule**: prefer `jit_kernel` for kernels that do not depend on CUTLASS or another large C++ project; use `sgl-kernel` (AOT, wheel-built) when they do. Exception: CUTLASS already provided through `flashinfer` can stay JIT.
- **`sgl_kernel/` abstraction mandate**: every kernel must use project headers (`tensor.h`, `utils.cuh`, `vec.cuh`, `tile.cuh`, `type.cuh`, `warp.cuh`, `cta.cuh`, `atomic.cuh`, `runtime.cuh`) rather than raw CUDA primitives; every `#include <sgl_kernel/...>` line must carry a trailing `// For ...` comment.
- **`TensorMatcher` is the only allowed validation path**: shape/dtype/device checks via fluent `SymbolicSize` / `SymbolicDType` / `SymbolicDevice` + `.verify()` chain; never manually check these fields.
- **`AlignedVector<T, N>`** enables vectorized 128-bit loads/stores (N = 16/sizeof(T) for fp16/bf16/fp32); 256-bit vectorization is viable on SM100+ only and must be gated by an architecture check.
- **`LaunchKernel` RAII launcher** resolves the CUDA stream from `DLDevice` automatically and checks errors with file/line info; `.enable_pdl(bool)` enables Programmatic Dependent Launch on SM90+. PDL is optional but should be tried when profiling suggests a benefit.
- **Persistent kernel pattern** caps grid to `SM_count × max_occupancy` via `runtime::get_blocks_per_sm` + `runtime::get_sm_count`; this is the idiomatic launch shape for bandwidth-bound element-wise kernels.
- **Python wrapper conventions**: use `cache_once` (not `functools.lru_cache`, which is incompatible with `torch.compile`); keep launchers thin but still validate CUDA device + supported dtype before launch; only compile-time specialisation knobs belong in the build marker.
- **CI test discovery is AST-based**: `run_suite.py` statically parses each `test_*.py` / `bench_*.py` for `register_cuda_ci(est_time=<literal>, suite="<literal>")` calls; computed values or helper wrappers silently break discovery. Every test file must contain at least one registration or the collector fails.
- **Benchmark suite**: `bench_*.py` files under `jit_kernel/benchmark/` register for `stage-b-kernel-benchmark-1-gpu-large`; the example compares JIT kernel against `torch` using Triton's `perf_report` harness.

## Visual observations

*No load-bearing images — source has no images*

## What this changes

- Operationalizes the **agent-amplified kernel authoring** pattern seen in [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]]: the SKILL turns kernel addition from a human-only task into an agent-executable one, using the in-tree abstraction catalogue to enforce codebase conventions without human code review for each detail.
- Provides the clearest primary-source specification of SGLang's `jit_kernel` abstraction layer — the `TensorMatcher` / `AlignedVector` / `LaunchKernel` trifecta is the canonical kernel API surface for new SGLang kernels.
- Illustrates the **SKILL-as-runbook** pattern: design knowledge (JIT vs AOT decision tree, PDL opt-in, CI discovery constraints) is encoded directly in the document that the agent reads and executes, not in external documentation.

## Entities touched

[[SGLang]], [[OpenAI Triton]], [[Hopper]], [[Blackwell]], [[CUDA]]

## Topics touched

[[GPU Programming Models]], [[Kernel Authoring]]

## Raw source

[github.com/sgl-project/sglang — .claude/skills/add-jit-kernel/SKILL.md](https://github.com/sgl-project/sglang/blob/main/.claude/skills/add-jit-kernel/SKILL.md) — Markdown document · ~620 lines · 5 complete code samples (CUDA `.cuh`, Python wrapper, optional build flags, pytest, Triton benchmark). Fetched 2026-05-15 via GitHub file-view adapter.
