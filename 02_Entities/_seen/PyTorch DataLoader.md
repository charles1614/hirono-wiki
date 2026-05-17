---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# PyTorch DataLoader

PyTorch's reference data-loading class — process-based workers, copies tensors via shared memory.

## Observations

- [[SPDL]]'s dual-concurrency benchmarks show that uniform concurrency (I/O=8, compute=8) leaves network at 40% utilization when fetching 1080p H.264 from S3; by contrast SPDL's staged design achieves 3.2x throughput improvement via independent concurrency tuning — demonstrating the single-`num_workers` knob as the architectural bottleneck of the process-based DataLoader model. — [[2026-01-20-deepwiki-spdl-03-core-architecture]]
