---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains
tags: [gpu, tooling, announcement]
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

## Visual observations

**Nsight Compute Tile Statistics — Details view** (`https://hirono-wiki.litenext.digital/raindrop/developer.nvidia.com/2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro/developer-nvidia-img-001.webp`)

![Nsight Compute report Details panel showing Tile Statistics section: Launch Execution Model = Tile, thread-blocks-launched 256, block-size 128, Tile Mapping callout, Tensor Memory Accelerator Unused warning, Tile Launch Configuration table (X/Y/Z), GPU Resource Usage table with TMA byte counts](https://hirono-wiki.litenext.digital/raindrop/developer.nvidia.com/2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro/developer-nvidia-img-001.webp)

The new Tile-kernel profiling surface — shows specific Tile metadata (mapping, TMA utilization, launch config) that doesn't exist for SIMT kernels. Load-bearing because the GPU-resource-usage tables visualize quantitative Tile-kernel data that prose can't tabulate as compactly.

**Nsight Compute Tile Statistics — Summary callouts** (`https://hirono-wiki.litenext.digital/raindrop/developer.nvidia.com/2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro/developer-nvidia-img-002.png`)

![Companion Nsight Compute summary screenshot highlighting the Tile Statistics section's chart-rule callouts: utilization of important pipelines, mapping back to high-level cuTile kernel source](https://hirono-wiki.litenext.digital/raindrop/developer.nvidia.com/2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro/developer-nvidia-img-002.png)

The companion summary screenshot — pairs with img-001 to show Nsight's two complementary Tile views (Details table + Summary chart-rules). Together they're the concrete UX the post's "Tile profiling" claim depends on.

- **`developer-nvidia-img-003.webp` / `*-004.webp` / `*-005.webp`** (supporting, not inlined): decorative concept-illustration diagrams. The two Nsight screenshots above carry the load-bearing tooling claim.

## Entities touched

[[CUDA]], [[CUDA Tile]], [[cuTile Python]], [[CUDA Tile IR]], [[Nsight Compute]], [[Compute Sanitizer]], [[Green Contexts]], [[MLOPart]], [[MPS]], [[cuBLAS]], [[Ampere]], [[Hopper]], [[Blackwell]], [[B200]], [[B300]], [[GB200]], [[RTX PRO 6000]], [[NVIDIA]]

## Topics touched

[[GPU Programming Models]], [[Kernel Authoring]], [[Multi-Tenancy on GPUs]], [[FP Emulation]]

## Raw source

[developer.nvidia.com/blog/nvidia-cuda-13-1-...](https://developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains) — ~7 KB blog post, 1 figure (Nsight Compute Tile Statistics screenshot). Published Dec 4 2025. Read 2026-05-11.
