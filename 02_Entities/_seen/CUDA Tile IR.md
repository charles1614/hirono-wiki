---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# CUDA Tile IR

NVIDIA's virtual instruction set for tile-based GPU programming, introduced in CUDA 13.1.

## Observations

<!-- merged from `Tile IR` on 2026-05-12 -->

- Virtual ISA for tile-based GPU programming introduced in CUDA 13.1 — the portable intermediate representation that [[CUDA Tile]]'s compiler targets. Sits below cuTile Python source and above hardware-specific PTX/SASS. Enables the "write once, run on future architectures" portability promise because hardware specialization (tensor cores, future units) is encoded in the compiler pass, not the programmer's source. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]

