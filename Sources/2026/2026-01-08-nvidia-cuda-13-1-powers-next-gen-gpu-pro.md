---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains/
tags: [cuda, nvidia, kernel-programming, blackwell, hopper, tile-programming]
---

# [2026-01-08] NVIDIA CUDA 13.1 Powers Next-Gen GPU Programming with NVIDIA CUDA Tile

## TL;DR

[[NVIDIA]] frames [[CUDA]] 13.1 (Dec 2025) as "the largest and most comprehensive update to the CUDA platform since it was invented two decades ago." Headliner: **[[CUDA Tile]]** — a tile-based programming model that sits *above* SIMT, abstracting away tensor cores and forward-compatible with future GPUs. Shipped in two forms: a new virtual ISA (Tile IR) and a Python DSL (cuTile Python). Direct competitive response to [[Triton]] and [[Pallas]] — NVIDIA wants the tile-programming layer back on its own roadmap, not OpenAI's or Google's.

## Key claims

- **CUDA Tile** is the strategic move: tile-level programming lets you write kernels in terms of *data tiles + math ops*, and the compiler decides thread-level execution. The pitch is identical to Triton's: "tile code is forward-compatible with future GPU architectures." NVIDIA explicitly reclaiming this layer.
- Two surfaces shipped: **CUDA Tile IR** (new virtual ISA — a Triton-IR analog), **cuTile Python** (DSL for authoring kernels — Triton-Python analog). C++ surface "in an upcoming release."
- Initial scope: AI algorithms, Ampere/Ada/Blackwell only (compute capability 8.x, 10.x, 11.x, 12.x). **Notably excludes Hopper (9.0)** — Hopper users stay on Triton/native CUDA for now.
- **Green contexts in the runtime API** (previously driver-only since CUDA 12.4) — lets latency-sensitive code claim dedicated SMs, separate from background work. Plus a more customizable `split()` API. The MPS story keeps getting more fine-grained.
- **MLOPart (Memory Locality Optimization Partition)** on Blackwell 10.0/10.3 (B200, B300) — single GPU presents as multiple CUDA devices with partitioned memory + compute, optimized for memory locality. GB200/GB300 support deferred.
- **Static SM partitioning for MPS**: deterministic resource allocation, "chunk" granularity is architecture-dependent (8 SMs on Hopper). Replaces dynamic provisioning when isolation matters.
- **cuBLAS FP64/FP32 emulation on Tensor Cores** (GB200 NVL72, RTX PRO 6000 Blackwell Server) — turns the Tensor Core into a path for HPC-style double-precision via FP-emulation. Bridges the AI/HPC silicon divide.
- **cuBLAS Grouped GEMM with CUDA Graphs (FP8 + BF16/FP16)** → **4× speed-up for MoE** vs multi-stream GEMM. Direct boost to MoE inference (cross-ref: [[TensorRT-LLM]] guide's MoE backend choice).
- Nsight Compute now profiles CUDA Tile kernels (Tile Statistics section); Nsight Systems gains hardware-trace-by-default + green-context timeline rows.
- Compute Sanitizer compile-time memcheck via `nvcc -fdevice-sanitize=memcheck` — instrument at compile time, run at near-native speed.

## Entities touched

[[NVIDIA]], [[CUDA]], [[CUDA Tile]], [[cuTile Python]], [[Tile IR]], [[Triton]], [[Pallas]], [[Blackwell]], [[Hopper]], [[Ampere]], [[Ada]], [[cuBLAS]], [[Nsight Compute]], [[Nsight Systems]]

## Topics touched

[[Kernel Authoring Languages]], [[GPU Resource Partitioning]], [[Low-Precision Training]], [[MoE Serving]]

## Open questions

- Why does CUDA Tile *exclude* Hopper (compute capability 9.0)? Hopper is the active production GPU — surfaces a SM-arch dependency that doesn't easily port back, or a strategic choice to push customers to Blackwell?
- **CUDA Tile vs Triton vs Pallas** — head-to-head is the obvious question. NVIDIA's framing is "Triton on NVIDIA's terms"; the win condition is whether Tile-IR-compiled kernels match or beat Triton kernels on the same hardware.
- **MoE 4× speedup via cuBLAS Grouped GEMM** — this is the most actionable production number in the post. How does it interact with TensorRT-LLM's MoE backend choice (TRTLLM/TRITON/CUTLASS — does Grouped GEMM get pulled into all three, or just `TRTLLM`)?
- MLOPart only on B200/B300; deferred for GB200/GB300. What about it doesn't work on GB200 yet? (NVLink-mesh complications?)
- The "rewritten CUDA programming guide" — has anyone done a side-by-side of old vs new to validate it's actually rewritten vs. relabeled?
- Cross-reference: how does this interact with [[NVFP4]] pretraining? FP4 needs new tensor-core paths — does CUDA Tile expose them, or are they cuBLAS-only?

## Raw source

[developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains](https://developer.nvidia.com/blog/nvidia-cuda-13-1-powers-next-gen-gpu-programming-with-nvidia-cuda-tile-and-performance-gains/) — ~17 KB body with five figures (Nsight UI, perf charts).
