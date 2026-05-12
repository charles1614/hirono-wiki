---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://ai.meta.com/blog/spdl-faster-ai-model-training-with-thread-based-data-loading-reality-labs/
tags: [data-loading, training, tooling]
---

# [2026-01-20] Introducing SPDL — Faster AI Model Training With Thread-Based Data Loading

## TL;DR

Meta Reality Labs blog (Nov 22 2024) introducing [SPDL](https://github.com/facebookresearch/spdl), a **framework-agnostic data-loading library that uses multi-threading instead of multi-processing**. The pitch is straightforward: in a regular CPython (with GIL), SPDL still achieves **2-3× higher throughput than PyTorch DataLoader's process-based workers** while using less compute. With **Free-Threaded Python + GIL disabled**, it's **+30% on top of that**. Pragma: many high-perf Python libraries already release the GIL during their hot loops; SPDL is the surrounding pipeline orchestration that lets you compose them without the subprocess penalty.

## Key claims

- **The problem with subprocess-based data loaders** (PyTorch DataLoader-style):
  1. **Memory cost per worker** — each subprocess gets a new Python interpreter + reloaded deps + copies of dataset/dataloader instances. "Multiple gigabytes per subprocess" in practice.
  2. **Double-copy of every batch tensor** — created in worker → serialized to shared memory → deserialized in main. At least 2× copy before training sees it.
  3. **GPU memory isolation** — worker can't write directly to main's GPU memory.
  4. **Spawn cost on every worker start**; fork is unsafe due to library-init segfaults.
  5. **PyTorch Profiler doesn't see worker call stacks** → blind spot in profiling.
  6. **Few tuning knobs** — `num_workers`, `pin_memory`, that's it. No per-stage concurrency control.
- **Why subprocesses anyway**: Python's GIL — true parallelism via threading isn't possible. SPDL's bet: many critical libraries (decoding, NumPy ops, async I/O) **already release the GIL during their hot work**, so threading IS effective when you compose the right libraries.
- **Free-Threaded Python is the future**: PEP 703 is shipping (3.13t). Once free-threading is widespread, threading-based dataloaders become the obvious choice. SPDL works in both regimes: regular CPython (gets 2-3× on its own merit), FT Python (gets +30% more when GIL is off).
- **The pipeline has three stages with different bottlenecks**, requiring **per-stage concurrency tuning**:
  - **Data acquisition** (remote storage fetch) → network-bandwidth bound.
  - **Preprocessing** (decode, augment, transform) → CPU bound.
  - **Transfer to GPU** → memory-bus bound.
  - Ideal pipeline: each stage runs at its own optimal concurrency level, no stage waits on another's queue.
- **SPDL design principles** (the 8 criteria):
  1. **High throughput** (the fundamental goal).
  2. **Per-stage performance measurability** (you can't tune what you can't measure).
  3. **No encapsulation in Dataset class** — preprocessing stages must be tunable independently.
  4. **No DSL** — researchers don't want another language to learn.
  5. **Async-utility-friendly** — natively async libraries should compose cleanly.
  6. **Flexible data shapes** (archives, multi-source, etc.).
  7. **Simple/intuitive API** — code should read like the pipeline diagram.
  8. **Fault tolerant** — network fails, media is malformed; pipeline must survive + log.
- **Benchmark numbers**:
  - **SPDL (CPython, GIL on) vs process-based**: 2-3× throughput, less compute.
  - **SPDL (FT Python, GIL off) vs SPDL (FT Python, GIL on)**: +30%.
- **Origin**: built by the GPU Efficiency Team at Meta Reality Labs (spatial computing — VR/AR models). Their workloads stress data loading because they iterate fast on multimodal models.

## What this changes

- **For training-infra teams**: Data loading is often the silent throughput killer at large GPU counts. SPDL gives a 2-3× lever even without FT Python. Worth evaluating against PyTorch DataLoader v1 + v2 for any GPU-utilization-bound training workload.
- **For the Python ecosystem**: SPDL is a concrete validation that FT Python's performance gains are real for production ML workloads, not just a theoretical exercise. The 30% headroom suggests training stacks will move to FT Python ASAP once 3.13t stabilizes.
- **For library authors**: SPDL's success rests on its component libraries releasing the GIL. This re-prioritizes "release the GIL in the C extension" as a critical Python-ecosystem competence. NumPy/PyTorch/Pillow etc. mostly do; less-mature libraries may need to follow.

## Entities touched

[[Meta]], [[Reality Labs]], [[SPDL]], [[PyTorch DataLoader]], [[Free-Threaded Python]], [[GIL]], [[PEP 703]]

## Topics touched

[[Data Loading]], [[LLM Training Systems]], [[GPU Utilization]], [[Python Concurrency]]

## Raw source

[ai.meta.com/blog/spdl-faster-ai-model-training-...](https://ai.meta.com/blog/spdl-faster-ai-model-training-with-thread-based-data-loading-reality-labs/) — ~11 KB body, code at [github.com/facebookresearch/spdl](https://github.com/facebookresearch/spdl). Published Nov 22 2024. Read 2026-05-11.
