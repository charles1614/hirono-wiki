---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 1
tier: seen
---

# CUDA Driver API

Low-level CUDA C API for direct GPU context and module management

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Handle-based imperative API (prefix `cu`); requires explicit `cuInit(0)` + `cuCtxCreate()` for context setup and `cuModuleLoad()` for PTX/binary loading; contexts are analogous to CPU processes — resources cleaned up on destroy. — [[2025-06-09-再议-driver-和-runtime-apis]]
- CUDA 12.0 introduced context-independent module loading via `cuLibraryLoadFromFile`/`cuLibraryGetKernel`/`cuKernel*` APIs; the driver auto-loads/unloads modules when contexts are created/destroyed, eliminating the need for frameworks to maintain `map<CUcontext, CUmodule>` state. — [[2025-06-09-再议-driver-和-runtime-apis]]
