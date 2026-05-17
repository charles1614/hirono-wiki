---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# UMMA

Universal MMA instruction for Blackwell GPU tensor core operations

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Replaces Hopper's `wgmma.mma_async` on [[Blackwell]] (WGMMA is deprecated on Blackwell); PTX instruction `tcgen05.mma`; supports FP4/FP6 precision, built-in block scaling, single-thread launch, and CTA-pair cross-SM cooperative execution. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
- Maximum atom size is 128×256×16 (2× WGMMA max); accumulator stored in [[Tensor Memory]] occupying half of TMEM (256 columns), enabling multi-atom pipelining without performance penalty; only one thread issues the PTX instruction while all threads in the warpgroup participate in the epilogue. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
- In [[CUTLASS]], UMMA is exposed via `SM100_MMA_F16BF16_SS` atom where ThrID layout is `Layout<_1>` (CTA peer layout, not thread layout); cut slice uses CTA peer ID (0 or 1), not threadIdx; `make_tmem_copy` with `SM100_TMEM_LOAD_32dp32b1x` extracts accumulator from TMEM to RMEM. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
- Consumer-grade Blackwell (compute capability 12.0, e.g. 5090d) lacks Tensor Memory and thus does not support UMMA; UMMA is exclusive to datacenter Blackwell (compute capability 10.0). — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
