---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 5
---

# Data Loading Pipelines

## What

*Stub topic — to be expanded from sources.*

<!-- merged from `Data Loading` on 2026-05-13 -->

Pipeline mechanics for moving training data from storage to GPU — bottleneck-isolation, threading vs multiprocessing, GIL-aware design.

## Current understanding

<!-- TODO: re-synthesize ## Current understanding (post-merge 2026-05-13) -->
Data loading pipelines are the infrastructure layer between raw storage and GPU memory during model training. They sit upstream of compute and are frequently the silent throughput bottleneck at large GPU counts — a point made directly in [[2026-01-20-introducing-spdl-faster-ai-model-trainin]].

**The three-stage model** is the load-bearing primitive. Every data loading pipeline passes through: (1) **data acquisition** (network/storage fetch — bandwidth-bound), (2) **preprocessing** (decode, augment, transform — CPU-bound), and (3) **GPU transfer** (memory-bus-bound). These stages have different bottleneck profiles and therefore require independent concurrency tuning. The core failure mode of naive pipelines is treating all three stages as one, forcing them to share a single concurrency setting that cannot be optimal for all three.

**The subprocess-vs-thread architectural split** is the defining design choice. PyTorch DataLoader's process-based model carries six structural costs: multiple-gigabyte memory overhead per worker (fresh Python interpreter + reloaded deps + dataset copies), double-copy of every batch tensor through shared memory, inability to write directly to the main process's GPU memory, spawn-cost on every worker start, profiler blindness to worker call stacks, and near-zero per-stage tuning knobs. The subprocess model exists because CPython's GIL prevents true thread-level parallelism — but this assumption is increasingly obsolete. Many critical libraries (NumPy, PyTorch ops, image decoders) already release the GIL during their computationally heavy C-extension work, making threading effective today on the hot path.

**SPDL** ([[2026-01-20-introducing-spdl-faster-ai-model-trainin]]) is the concrete instantiation of the threading alternative from Meta Reality Labs. It achieves **2-3× higher throughput than PyTorch DataLoader** on regular CPython (GIL on) and an additional +30% with Free-Threaded Python (GIL disabled, PEP 703 / CPython 3.13t). The design principles rule out DSLs and Dataset-class encapsulation in favor of explicit per-stage concurrency control and async-native composition.

**Free-Threaded Python is the medium-term forcing function.** SPDL's +30% headroom from GIL removal is a forward-looking signal: training stacks that adopt FT Python early gain an additional lever without changing the pipeline architecture. This makes threading-based dataloaders the structural bet for the next generation of training infrastructure, independent of SPDL specifically.

The current corpus has one source on this topic. The three-stage model and the subprocess-vs-thread tradeoff are well-documented; what is not yet covered includes disk-format considerations (WebDataset / MosaicML StreamingDataset / TFDS sharding strategies), multi-modal heterogeneous batching pipelines, and the interaction between data loading and distributed-training communication overlap.

<!-- merged from `Data Loading` on 2026-05-13 -->

No sources have been ingested for this topic yet. The framing covers pipeline mechanics for moving training data from storage to GPU — bottleneck isolation, threading vs multiprocessing, and GIL-aware design — but no cited Sources are available to ground claims.

Populate once Sources covering PyTorch `DataLoader` internals, distributed data loading (e.g. `IterableDataset`, `webdataset`, DALI), or profiling studies of storage-to-GPU pipelines are ingested and linked here.

## Observations

- SPDL overview (arXiv 2504.20067): 54 Python files + 89 C++ files (~13k LoC each); supports FFmpeg 4–8, CUDA 7.5+ (Turing/Ampere/Ada/Hopper); hardware acceleration gives NVDEC 5–10x video speedup, NVJPEG 10–20x JPEG speedup vs CPU; per-stage Perfetto tracing + stats (avg/p95/throughput) create an iterative optimization loop; BSD 2-Clause. NOT a drop-in PyTorch DataLoader replacement — requires pipeline rearchitecture. — [[2026-01-20-deepwiki-spdl-01-overview]]
- SPDL's core architecture separates I/O-bound stages (needing 24–64 concurrent tasks to saturate network bandwidth) from compute-bound stages (8–12 tasks matching CPU core count) via per-stage `concurrency=` parameters on a shared thread pool; asyncio event loop in a background thread orchestrates queue coordination; dual-concurrency configuration (I/O=32, compute=8) achieves 3.2x throughput over uniform (I/O=8, compute=8) on 1080p H.264 from S3. — [[2026-01-20-deepwiki-spdl-03-core-architecture]]

## Open threads

- SPDL vs NVIDIA DALI head-to-head: DALI is C++-based GPU-side decoding (very different architecture, same goal of saturating GPUs). The SPDL post doesn't compare; concrete benchmarks would clarify when to pick each. — [[2026-01-20-introducing-spdl-faster-ai-model-trainin]]


## Sources drawn on

- (auto-populated by reindex)

<!-- merged from `Data Loading` on 2026-05-13 -->

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

