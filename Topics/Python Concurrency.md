---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Python Concurrency

## What

*Stub topic — to be expanded from sources.*

## Current understanding

Python concurrency is shaped by a single structural constraint: the **Global Interpreter Lock (GIL)**. In CPython, the GIL prevents true parallel execution of Python bytecode across threads, which has historically made multi-threading useless for CPU-bound work and pushed I/O-parallel designs toward multi-processing instead.

The standard workaround — **multi-processing** — sidesteps the GIL by spinning up isolated subprocess workers, each with its own interpreter. PyTorch DataLoader exemplifies this pattern for ML workloads. The cost is steep: multiple gigabytes of memory per worker (reloaded interpreter + deps + dataset copies), double-copying every tensor through shared memory, no GPU-memory sharing across processes, and zero visibility in profilers. [[2026-01-20-introducing-spdl-faster-ai-model-trainin]]

**Threading is more effective than its reputation suggests** when the hot work happens inside C extensions that release the GIL. Libraries like NumPy, PyTorch (compute kernels), Pillow, and most async I/O stacks already release the GIL during their heavy operations. A thread-pool-based pipeline orchestrating these libraries achieves real parallelism — the GIL is only held for Python-level bookkeeping between calls, not for the expensive work. SPDL at Meta is the concrete proof point: a thread-based data loader achieves **2–3× higher throughput than process-based PyTorch DataLoader**, with less compute and none of the subprocess overhead. [[2026-01-20-introducing-spdl-faster-ai-model-trainin]]

The **pipeline shape matters** more than raw thread count. Data loading for ML has three stages with different bottlenecks — network-I/O-bound acquisition, CPU-bound preprocessing, and memory-bus-bound GPU transfer — and each needs its own concurrency level. A single `num_workers` knob (as in PyTorch DataLoader) cannot tune all three independently. The right architecture is a staged pipeline where each stage runs at its natural concurrency without stalling on adjacent stages' queues. [[2026-01-20-introducing-spdl-faster-ai-model-trainin]]

The trajectory of the ecosystem is toward **Free-Threaded Python (PEP 703 / CPython 3.13t)**, which disables the GIL entirely. With the GIL off, thread-based designs gain a further ~30% on top of the gains already achievable in regular CPython (where GIL-releasing C extensions already carry most of the work). The implication is that threading-first concurrency — already competitive today — becomes the dominant model once 3.13t stabilizes. Libraries that do not release the GIL in their C extensions will become concurrency bottlenecks; "release the GIL in the hot path" is becoming a first-class Python ecosystem competence. [[2026-01-20-introducing-spdl-faster-ai-model-trainin]]

**Load-bearing primitives** from sources so far:

- **GIL** — the structural constraint that defines the design space.
- **C-extension GIL release** — the mechanism that makes threading viable today; the key variable when evaluating a library's concurrency behavior.
- **Multi-processing (subprocess-based)** — the historical escape hatch; high memory cost, double-copy penalty, no GPU sharing, profiler blind spot.
- **Thread-pool staging** — the preferred architecture when component libraries are GIL-cooperative; per-stage concurrency tuning is the operational knob.
- **Free-Threaded Python (PEP 703)** — the near-term structural change that removes the GIL and makes threading-first the unconditional winner for parallel Python.

## Open threads

- Thread-context-switch overhead at very high concurrency with Free-Threaded Python — subprocess models avoid that via OS-scheduler isolation. Benchmarks at >32 worker threads on a contended CPU pool would settle whether SPDL's threading model degrades. — [[2026-01-20-introducing-spdl-faster-ai-model-trainin]]


## Sources drawn on

- (auto-populated by reindex)
