---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains
tags: [cuda, cuda-tile, blackwell, hopper, ampere, mps, green-contexts, cutile, nvidia]
---

# [2026-01-08] NVIDIA CUDA 13.1 — CUDA Tile Programming Model + Platform Updates

## TL;DR

NVIDIA's CUDA 13.1 release post (Dec 4 2025) frames itself as **"the largest and most comprehensive update to the CUDA platform since it was invented two decades ago"** — strong claim, anchored by **CUDA Tile**, a new tile-based programming model that sits *above* SIMT. Two release components: **CUDA Tile IR** (virtual ISA) and **cuTile Python** (DSL). The pitch: write algorithm-level tile operations; let the compiler+runtime map tiles to threads + tensor cores + future GPU architectures. Also notable: runtime-API exposure of **green contexts** (lightweight context-style SM partitioning previously driver-only), **Memory Locality Optimization Partition (MLOPart)** for Blackwell B200/B300, **static SM partitioning** for MPS, **FP32/FP64 emulation on Tensor Cores** (cuBLAS), and Nsight Compute 2025.4 Tile-kernel profiling.

## Key claims

- **CUDA Tile** is the headline. Replaces "partition data + define each thread's path" (SIMT) with "operate on tiles + let compiler/runtime decide thread launch." Critical pitch: **tile code is portable to future GPU architectures** because the compiler abstracts hardware specialization (tensor cores, future units).
  - **CUDA Tile IR**: virtual ISA for tile-based GPU programming.
  - **cuTile Python**: DSL for tile-based kernels in Python.
  - **Scope today**: Ampere / Ada / Blackwell (compute capability 8.x, 10.x, 11.x, 12.x). AI algorithms targeted first. **C++ implementation planned for future release** (currently Python-only).
- **Green contexts** in the runtime API (previously driver-only since CUDA 12.4). Lightweight context-style SM partitioning. Use case: a latency-sensitive code path gets dedicated SMs via one green context, everything else gets another. Customizable `split()` API now consolidates previous multi-call flows + lets developers configure work queues to minimize false dependencies.
- **Memory Locality Optimization Partition (MLOPart)**: Blackwell-only (compute capability 10.0 and 10.3 — B200/B300; GB200/GB300 in a future release). Creates "specialized CUDA devices optimized for memory locality" — each underlying GPU presents as multiple devices with fewer compute resources + less memory. Compute capability 10.0/10.3 GPUs get **two partitions**. Note: this is *not* the same thing as MIG; MLOPart is a memory-locality optimization, not a multi-tenant isolation.
- **Static SM Partitioning for MPS** (`-S` / `--static-partitioning` flag on MPS daemon). Ampere+ (compute capability 8.0+). **Chunk-size 8 SMs on Hopper+**. Provides deterministic resource allocation between MPS clients vs. the existing dynamic provisioning.
- **cuBLAS FP32/FP64 emulation on Tensor Cores**: introduced in CUDA 13.0 actually (carries forward to 13.1). Targets **GB200 NVL72** and **RTX PRO 6000 Blackwell Server Edition**. Lets double/single-precision matmuls benefit from Tensor-Core speed via emulation.
- **Tooling updates**:
  - Nsight Compute 2025.4 — Tile-kernel profiling (Tile Statistics section, cuTile source mapping, Tile vs SIMT result-type column). Also profiles device-launched CUDA graph nodes.
  - Compute Sanitizer 2025.4 — compile-time patching via `nvcc -fdevice-sanitize=memcheck`. Faster runs + more subtle memory errors caught (base-and-bounds analysis between adjacent allocations).
- **CUDA programming guide rewritten** for both novice and advanced programmers. Significant signal that NVIDIA expects the audience to expand with Tile programming.

## What this changes

- **For kernel authors**: a new abstraction level is now official. The "we can't keep writing per-arch kernels for every new GPU" pain is real (cf. [[2025-10-09-flux-fast-software-based-communication-o]] showing how much CUTLASS-level tuning takes per arch); cuTile is NVIDIA's answer.
  - But: cuTile is Python-only in this release; large-scale production kernels (FlashAttention, vLLM PA kernels) are CUDA C++/CUTLASS. The C++ landing is the milestone to watch.
- **For multi-tenant inference**: green-contexts-in-runtime + static MPS partitioning + MLOPart are all toolkit-level upgrades for **predictable GPU sharing**. Relevant to PD-disaggregation (separate prefill and decode pools per green context) and to MPS-based inference deployments.
- **For training operators on Blackwell**: cuBLAS FP32/FP64 Tensor-Core emulation matters for scientific workloads + the mixed-precision training paths that still need real FP64 for some operations. On GB200, free-ish FP64 via emulation changes algorithm choice.
- **For NVIDIA's competitive posture**: the rewrite-from-the-ground-up framing is unusual. Likely a response to Triton's gravitational pull on kernel authors + the broader compiler-first push from Mojo, TVM, JAX. NVIDIA's bet: stay open with a virtual ISA layer (Tile IR), keep the perf-portability story believable.

## Entities touched

[[CUDA]], [[CUDA Tile]], [[cuTile Python]], [[CUDA Tile IR]], [[Nsight Compute]], [[Compute Sanitizer]], [[Green Contexts]], [[MLOPart]], [[MPS]], [[cuBLAS]], [[Ampere]], [[Hopper]], [[Blackwell]], [[B200]], [[B300]], [[GB200]], [[RTX PRO 6000]], [[NVIDIA]]

## Topics touched

[[GPU Programming Models]], [[Kernel Authoring]], [[Multi-Tenancy on GPUs]], [[FP Emulation]]

## Open questions

- **cuTile Python vs Triton** — what's the boundary? Both target the "above SIMT" sweet spot; both have Python frontends. cuTile claims compiler-managed tensor-core mapping; Triton has that too. Worth a careful comparison in a follow-up.
- **CUDA Tile C++** — when does it land? The Python-only-today positioning suggests this is the larger drop. Production stacks (vLLM, TRTLLM, etc.) won't move until C++ ships.
- **MLOPart**: how is it different from MIG (Multi-Instance GPU)? Both partition a single GPU; MIG provides isolation, MLOPart provides memory-locality optimization. Are they orthogonal (combine them?) or competing?
- **Green contexts** scaling: any limit on how many green contexts you can create on a single GPU? Practical concern for fine-grained scheduling experiments.

## Raw source

[developer.nvidia.com/blog/nvidia-cuda-13-1-...](https://developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains) — ~7 KB blog post, 1 figure (Nsight Compute Tile Statistics screenshot). Published Dec 4 2025. Read 2026-05-11.
