---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# CUDA Runtime API

High-level CUDA C API providing abstracted GPU memory and kernel management

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- High-level abstraction (prefix `cuda`); `cudaMalloc`/`cudaFree`/`cudaMemcpy` for device memory; runtime implicitly creates primary context per device on first call, transparent JIT compilation of device code, no manual context management required. — [[2025-06-09-再议-driver-和-runtime-apis]]
- Runtime and Driver APIs are interoperable: Driver API can create a context that Runtime can then use; `cuCtxGetCurrent()` retrieves runtime-initialized context; device memory allocations and frees are cross-compatible (CUdeviceptr ↔ pointer cast). — [[2025-06-09-再议-driver-和-runtime-apis]]
