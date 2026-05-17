---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 5
tier: active
---

# Tensor Memory

Blackwell GPU on-chip dedicated memory (TMEM) for tensor core accumulator storage

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Each [[Blackwell]] SM has 256 KB TMEM (same size as register file); organized as 512 columns × 128 rows (lanes) × 32-bit cells; 32-bit addressing: high 16 bits = lane ID, low 16 bits = column, resulting in stride of 65536 (1<<16) in CuTe layouts. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
- Allocated via `tcgen05.alloc` (min 32 columns, must be power of 2), released via `tcgen05.dealloc`; same warp must allocate and free; address stored in SMEM for cross-warp access; [[CUTLASS]] wraps this in `cute::TMEM::Allocator1Sm`. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
- For [[UMMA]] operations: operand A can be in TMEM or SMEM; operand B must be in SMEM; accumulator D must be in TMEM; data is loaded out of TMEM to registers via `tcgen05.ld` (warp-level sync instruction) for epilogue processing. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
