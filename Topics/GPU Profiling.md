---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 4
---

# GPU Profiling

## What

The practice of measuring and attributing GPU (and CPU) performance using sampling and tracing tools — identifying hotspots, understanding kernel utilization, and correlating hardware counters with application code. Distinct from higher-level observability (distributed tracing, metrics dashboards) in that it operates at the hardware-timeline / kernel level.

## Current understanding

The primary NVIDIA toolchain splits into two complementary instruments: [[Nsight Systems]] for system-level statistical sampling + API tracing across the full CPU–GPU timeline, and [[Nsight Compute]] for kernel-level SM/warp/memory analysis with source-line attribution. These address different diagnostic questions — "where is time spent across the whole workload?" vs. "why is this specific kernel not hitting peak throughput?"

[[Nsight Systems]] uses CUPTI (CUDA Profiling Tools Interface) as the underlying mechanism for CUDA API trace and GPU workload visibility. NVTX annotations allow user code to inject ranges and markers that appear in the timeline alongside kernel execution. A system-level self-check (`nsys status -e`) reports whether the host satisfies Linux perf prerequisites (`perf_event_paranoid ≤ 2`, kernel ≥ 4.3), which govern whether IP-sample + thread-scheduling collection is available.

For production LLM serving systems, GPU profiling complements but does not replace higher-level observability (spans, Prometheus metrics). [[2026-04-03-deepseek-ai-profile-data-analyze-computa]] shows PyTorch Profiler JSON traces published by DeepSeek for community inspection of computation-communication overlap; [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]] shows an ergonomic automation layer on top of raw profiler output. Neither PyTorch Profiler nor standard tooling covers multi-parallelism (TP/DP/PP/EP) concurrency across production windows well — see [[Observability]] for that layer.

The [[Nsight Systems]] CLI workflow for distributed workloads follows a consistent pattern: `nsys profile` wraps the *application binary* (not the launcher); multi-node MPI/DeepSpeed/torchrun jobs embed rank/PID in the output filename via `%q{OMPI_COMM_WORLD_RANK}` / `%p` to avoid write collisions. Network-layer visibility requires explicit trace flags: `--trace=mpi` for MPI collectives, `--trace=nccl` for [[NCCL]] all-reduces, `--trace=ucx` for UCX. Python-native workflows use `--pytorch=functions-trace` (no source changes, forward/backward/step shapes logged) or GIL tracing to surface Python-layer bottlenecks alongside CUDA activity. Post-collection, `nsys export sqlite` produces a queryable schema for offline analysis; `nsys stats` and `nsys recipe` cover statistical summaries and plots headlessly. — [[2025-08-17-user-guide-nsight-systems]]

## Open threads

- How does [[Nsight Systems]]' system-level timeline integrate with OTel-span-based request tracing in multi-node serving clusters? Corpus has both tool references but no source describing a unified view.

## Sources drawn on

- [[2025-08-18-installation-guide-nsight-systems]] — install reference: editions, platform support, CLI vs GUI, CUPTI + NVTX mechanisms
- [[2025-08-17-user-guide-nsight-systems]] — usage reference: `nsys profile` CLI, focused profiling, multi-node MPI/NCCL/torchrun patterns, Python/PyTorch profiling, SQLite export
