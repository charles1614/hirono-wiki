---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 7
tier: active
---

# CUDA

NVIDIA's GPU programming platform — language extensions, runtime, toolkit, libraries.

## Synthesis


NVIDIA's GPU programming platform — language extensions, runtime, toolkit, and libraries — received its largest update since launch with CUDA 13.1 (December 2025). The headline addition is CUDA Tile, a new programming model above SIMT that lets developers write tile-level algorithm operations and have the compiler map them to threads, Tensor Cores, and future GPU architectures; it ships today as cuTile Python (with a C++ implementation planned) targeting Ampere, Ada, and Blackwell. Supporting the Tile model, Nsight Compute 2025.4 adds a dedicated Tile Statistics profiling surface — launch configuration, TMA utilization, and cuTile source mapping — while Compute Sanitizer 2025.4 gains compile-time patching via nvcc for faster, more precise memory-error detection. The release also promotes green contexts from the driver API to the runtime API for flexible SM partitioning, introduces MLOPart on Blackwell B200/B300 for memory-locality optimization, adds static SM partitioning for MPS, and carries forward cuBLAS FP32/FP64 emulation on Tensor Cores from CUDA 13.0. The CUDA programming guide was rewritten end-to-end, signaling that NVIDIA expects Tile programming to substantially broaden the developer audience.


## Observations

- CUDA 13.1 (Dec 2025) introduces a substantial platform refresh: **CUDA Tile** programming model (Tile IR + cuTile Python) targeting "above SIMT" kernel authoring with compiler-managed Tensor-Core mapping; **green contexts** moved from driver API to runtime API (with customizable `split()` for SM partitioning); **MLOPart** for Blackwell memory-locality partitioning; cuBLAS FP32/FP64 Tensor-Core emulation; Nsight Compute 2025.4 Tile profiling; Compute Sanitizer compile-time patching. Programming guide rewritten end-to-end. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- Profiling support for CUDA workloads uses CUPTI (CUDA Profiling Tools Interface) — the mechanism behind [[Nsight Systems]]' CUDA Runtime/Driver API trace and GPU timeline. CUDA 10.0+ is the floor for most platforms; Arm SBSA requires 10.2+. Driver and toolkit must be paired per the published compatibility table. — [[2025-08-18-installation-guide-nsight-systems]]
