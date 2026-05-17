---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# SPDL

Scalable and Performant Data Loading; Meta Reality Labs' thread-based PyTorch DataLoader replacement.

## Synthesis

*Regenerated from Observations below.*

## Observations

- SPDL's core architectural insight is that I/O-bound (fetch/demux, needing 24–64 concurrent tasks) and compute-bound (decode/transform, matching CPU core count at 8–12 tasks) operations have fundamentally different scaling profiles; the design uses per-stage `concurrency=` parameters on a shared thread pool rather than a single `num_workers` knob. — [[2026-01-20-deepwiki-spdl-03-core-architecture]]
- Pipeline orchestration uses an asyncio event loop in a dedicated background thread; foreground communicates via `run_coroutine_threadsafe()` + shared sink queue; the loop stays alive after pipeline task completion to allow foreground to drain remaining items via `get_nowait()`. — [[2026-01-20-deepwiki-spdl-03-core-architecture]]
- Benchmarked dual concurrency (I/O=32, compute=8) vs. uniform (I/O=8, compute=8) on 1080p H.264 from S3: network utilization improved from 40% to 95%, yielding 3.2x overall throughput; architecture inspired by Tesla's Accelerated Video Library (AI Day 2022). — [[2026-01-20-deepwiki-spdl-03-core-architecture]]
- Overview: SPDL is [[Meta]] Reality Labs' library for high-performance ML data pipelines; C++ core (libspdl, ~13k LoC) releases the Python GIL during I/O and compute, enabling 3–5x throughput and 50–70% memory reduction vs multiprocessing; supports NVDEC (5–10x faster video decode), NVJPEG (10–20x JPEG), and NPP; BSD 2-Clause, arXiv 2504.20067. Design philosophy is "give tools, not magic" — no auto-tuning, operator tunes via Perfetto metrics. — [[2026-01-20-deepwiki-spdl-01-overview]]
