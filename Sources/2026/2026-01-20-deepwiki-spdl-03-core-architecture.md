---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/spdl?file=03-core-architecture
tags: [training, data-loading, tooling]
---

# [2026-01-20] DeepWiki SPDL — Core Architecture

## TL;DR

Deep-dive into SPDL's dual thread-pool + async event-loop architecture for high-performance ML data loading. The design separates I/O-bound (fetch, demux — high concurrency 24–64 tasks) from compute-bound (decode, transform — CPU-core-matched 8–12 tasks) pipeline stages, coordinated by an asyncio event loop in a background thread, achieving 3–5x throughput over PyTorch DataLoader on video workloads with 40–60% lower memory.

## Key claims

- SPDL's core insight is that I/O-bound and compute-bound operations scale differently: I/O stages need 24–64 concurrent tasks to saturate network bandwidth (each task CPU-idle <10%), while compute stages need 8–12 tasks matching physical CPU core count; a unified thread pool cannot be optimal for both.
- The implementation uses a single physical thread pool (size = `num_threads` in `build_pipeline()`) with per-stage `concurrency=` parameters — the "dual pool" is conceptual, not physical; custom per-stage `ThreadPoolExecutor` instances can be passed for true pool isolation.
- Pipeline orchestration uses an asyncio event loop running in a dedicated background thread; the foreground thread communicates via `run_coroutine_threadsafe()` and a shared sink queue; when the pipeline task completes the loop stays alive to allow foreground to drain remaining items.
- GIL release: all C++ operations (FFmpeg demux, video decode, image preprocessing) release the GIL, enabling true multi-core parallelism from Python without multi-processing overhead (no 100ms+ process creation, no serialization, no memory duplication).
- Architecture is inspired by Tesla's Accelerated Video Library (AI Day 2022), which identified the same I/O vs. compute bottleneck split for autonomous driving video training datasets.
- Benchmarked dual concurrency config (I/O=32, compute=8) vs. uniform (I/O=8, compute=8) on 1080p H.264 from S3: network utilization improved from 40% to 95%, yielding 3.2x overall throughput improvement.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[SPDL]], [[PyTorch DataLoader]]

## Topics touched

[[Data Loading Pipelines]], [[Python Concurrency]]

## Raw source

[wiki.litenext.digital/wiki/spdl?file=03-core-architecture](https://wiki.litenext.digital/wiki/spdl?file=03-core-architecture) — DeepWiki auto-generated architecture reference for SPDL; captured 2026-01-20. Read 2026-05-15.
