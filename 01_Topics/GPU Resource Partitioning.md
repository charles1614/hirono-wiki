---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 2
---

# GPU Resource Partitioning

## What

*Stub topic — to be expanded from sources.*

## Current understanding

GPU resource partitioning refers to the mechanisms by which a single physical GPU is divided — spatially, temporally, or by memory locality — among multiple workloads, contexts, or tenants. As of CUDA 13.1, NVIDIA exposes at least four distinct partitioning primitives that differ in granularity, mutability, isolation guarantees, and hardware generation requirements ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]).

**Green contexts** are the lightest-weight mechanism: they partition the GPU's Streaming Multiprocessors (SMs) between logical contexts without full process isolation ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]). Previously driver-only since CUDA 12.4, they became a first-class runtime API in CUDA 13.1. The `split()` API consolidates what used to require multiple calls and lets developers configure work queues to minimize false dependencies between co-running workloads. The primary use case is a latency-sensitive path that needs a dedicated SM allocation alongside background work on the same device.

**Static SM partitioning for MPS** adds determinism to Multi-Process Service deployments ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]). The existing MPS daemon provisioned SM resources dynamically across clients; the new `-S` / `--static-partitioning` flag on Ampere+ (compute capability 8.0+) guarantees fixed allocations at daemon start, with a chunk size of 8 SMs on Hopper and later. This matters for inference serving where per-client latency SLAs need a predictable hardware share across multiple concurrent processes sharing one GPU context.

**Memory Locality Optimization Partition (MLOPart)** is a Blackwell-specific (compute capability 10.0/10.3 — B200/B300) mechanism that presents a single physical GPU as multiple CUDA devices, each with fewer compute resources and less memory, explicitly optimized for memory locality ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]). B200/B300 get two partitions. NVIDIA explicitly distinguishes MLOPart from MIG: MLOPart is a memory-locality optimization, not a multi-tenant isolation boundary. No equivalent exists on pre-Blackwell GPUs.

**MIG (Multi-Instance GPU)** — referenced in CUDA 13.1 documentation as the contrast case for MLOPart — provides full hardware isolation via dedicated SM slices, caches, and memory bandwidth per partition ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]). It is the isolation primitive for hard multi-tenancy where fault containment is required. CUDA 13.1 did not add new MIG features; it reinforces that MIG and MLOPart are orthogonal in purpose.

The four mechanisms occupy different points on a tradeoff curve. Green contexts are low-overhead and flexible (software-configurable SM splits, no isolation, Ampere+); static MPS partitioning adds determinism for multi-process serving but still shares a single GPU context; MLOPart is a hardware-level locality partition only on Blackwell; MIG gives the strongest isolation at the cost of reduced utilization flexibility. The corpus currently has only one source covering this topic, so quantitative performance tradeoffs between mechanisms (e.g. green context vs. static MPS at equivalent SM split ratios, or MLOPart throughput vs. full-GPU baseline) are not yet covered.

## Comparison

| Axis | Green Contexts | Static MPS Partitioning | MLOPart | MIG |
|---|---|---|---|---|
| **Partitioning dimension** | SM allocation between logical contexts ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | SM allocation between MPS clients ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Physical GPU → multiple CUDA devices, locality-optimized ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Hardware slices: SMs + caches + memory bandwidth ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) |
| **Isolation guarantee** | None — no fault or memory isolation ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Shared GPU context; no fault isolation ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | None — memory-locality optimization only ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Full hardware isolation — fault + performance ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) |
| **Allocation mutability** | Software-configurable via `split()` API ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Fixed at daemon start via `-S` flag ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Fixed at device-presentation time ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Fixed per MIG instance configuration ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) |
| **Min hardware requirement** | Ampere (CC 8.0+); driver-only since CUDA 12.4, runtime API since CUDA 13.1 ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Ampere (CC 8.0+); chunk size 8 SMs on Hopper+ ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Blackwell only — CC 10.0/10.3 (B200/B300); GB200/GB300 future release ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | A100/H100+ (CC 8.0+); ? on Blackwell |
| **Partition count** | Configurable (multiple green contexts per GPU) ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Configurable (multiple MPS clients) ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | 2 partitions on CC 10.0/10.3 (B200/B300) ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Up to 7 on A100; ? on H100/Blackwell |
| **Primary use case** | Latency-sensitive path gets dedicated SMs; background work gets remainder ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Inference serving: predictable per-client hardware share across MPS clients ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Memory-locality optimization for Blackwell workloads ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Hard multi-tenancy where fault containment is required ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) |
| **API surface** | `split()` runtime API (CUDA 13.1) ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | `-S` / `--static-partitioning` flag on MPS daemon ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Exposed as separate CUDA devices ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | ? (MIG tooling not covered by corpus source) |
| **Complements or replaces MIG?** | Complements — lighter-weight, no isolation ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Complements — MPS and MIG are orthogonal ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | Complements — explicitly not MIG; orthogonal goals ([[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]) | N/A — MIG is the reference isolation primitive |

## Open threads

- MLOPart vs MIG (Multi-Instance GPU): orthogonal (combine?) or competing? Both partition a single GPU but with different optimization goals (locality vs isolation). — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- Green contexts — any limit on how many you can create per GPU? Practical concern for fine-grained scheduling experiments. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]

## Sources drawn on

- (auto-populated by reindex)
