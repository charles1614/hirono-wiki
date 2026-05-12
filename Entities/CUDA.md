---
created: 2026-05-11
updated: 2026-05-11
type: entity
refs: 1
tier: active
---

# CUDA

NVIDIA's GPU programming platform — language extensions, runtime, toolkit, libraries.

## Synthesis

NVIDIA's GPU programming platform — language extensions, runtime, toolkit, libraries. The **2025-12 CUDA 13.1 release** is positioned as the platform's largest update "since CUDA was invented two decades ago," introducing CUDA Tile (Tile IR + cuTile Python) as a new abstraction above SIMT, runtime-API green contexts, MLOPart for Blackwell, FP32/FP64 emulation on Tensor Cores, and rewritten programming-guide docs.

## Observations

- CUDA 13.1 (Dec 2025) introduces a substantial platform refresh: **CUDA Tile** programming model (Tile IR + cuTile Python) targeting "above SIMT" kernel authoring with compiler-managed Tensor-Core mapping; **green contexts** moved from driver API to runtime API (with customizable `split()` for SM partitioning); **MLOPart** for Blackwell memory-locality partitioning; cuBLAS FP32/FP64 Tensor-Core emulation; Nsight Compute 2025.4 Tile profiling; Compute Sanitizer compile-time patching. Programming guide rewritten end-to-end. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
