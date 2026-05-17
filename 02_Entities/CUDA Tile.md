---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# CUDA Tile

NVIDIA's tile-based programming model (CUDA 13.1+); cuTile Python DSL + Tile IR; sits above SIMT.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Introduced in CUDA 13.1 (Dec 2025) as NVIDIA's abstraction layer above SIMT. Programmer specifies tile-level math operations; compiler + runtime decide the best thread/[[Tensor Core]] mapping. Two components: **CUDA Tile IR** (virtual ISA) and **cuTile Python** (Python DSL). Hardware scope: Ampere / Ada / Blackwell (compute capability 8.x, 10.x, 11.x, 12.x). AI algorithms targeted first; C++ implementation planned for a future release. Portability to future GPU architectures is the explicit design goal. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
