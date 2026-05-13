---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# GPU Resource Partitioning

## What

*Stub topic — to be expanded from sources.*

## Current understanding

GPU resource partitioning refers to the set of mechanisms by which a single physical GPU is divided — spatially, temporally, or by memory locality — among multiple workloads, contexts, or tenants. As of CUDA 13.1, NVIDIA exposes at least three distinct partitioning primitives that differ in granularity, mutability, and target use case.

**Green contexts** ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) are the lightest-weight mechanism: they partition the GPU's Streaming Multiprocessors (SMs) between logical contexts without full process isolation. Previously driver-only since CUDA 12.4, they are now a first-class runtime API. A latency-sensitive path gets its own dedicated SM allocation via one green context; background work gets another. The `split()` API consolidates what used to be multiple calls and allows developers to configure work queues to minimize false dependencies between co-running workloads.

**Static SM partitioning for MPS** ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) adds determinism to Multi-Process Service (MPS) deployments. The existing MPS daemon provisioned SM resources dynamically across clients; the new `-S` / `--static-partitioning` flag on Ampere+ (compute capability 8.0+) guarantees fixed allocations at daemon start. Chunk size is 8 SMs on Hopper and later. This matters for inference serving where per-client latency SLAs need predictable hardware share.

**Memory Locality Optimization Partition (MLOPart)** ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) is a Blackwell-specific (compute capability 10.0/10.3 — B200/B300) mechanism that presents a single physical GPU as multiple CUDA devices, each with fewer compute resources and less memory, explicitly optimized for memory locality. B200/B300 get two partitions. NVIDIA's documentation explicitly distinguishes MLOPart from MIG: MIG provides full hardware isolation for multi-tenancy; MLOPart is a memory-locality optimization that trades raw capacity for locality.

The three mechanisms occupy different points on a tradeoff curve: green contexts are low-overhead and flexible (software-configurable SM splits, no isolation guarantees); static MPS partitioning adds determinism for multi-process serving; MLOPart is a hardware-level locality partition with no equivalent on pre-Blackwell GPUs. None of these replaces MIG, which remains the isolation primitive for hard multi-tenancy. The corpus currently has only one source on this topic, so the relative performance tradeoffs between mechanisms (e.g. green context vs. static MPS at the same SM split ratio) are not yet covered.

## Open threads

- MLOPart vs MIG (Multi-Instance GPU): orthogonal (combine?) or competing? Both partition a single GPU but with different optimization goals (locality vs isolation). — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- Green contexts — any limit on how many you can create per GPU? Practical concern for fine-grained scheduling experiments. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]


## Sources drawn on

- (auto-populated by reindex)
