---
created: 2026-05-11
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# WGMMA

Hopper+ instruction for async warpgroup-level matrix multiply; cornerstone of FlashAttention-3 + FlashMLA.

## Synthesis

*Regenerated from Observations below.*

## Observations

- `wgmma`（warpgroup-level MMA）是 Hopper 引入的 4th gen TC 指令，128 线程 warpgroup 共同执行，操作数 B 直接从 SMEM 读（无需先加载到 register），支持形状 `m64nNk16`（N 可为 8–256 的倍数，远超 Ampere 的 `m16n8k16`）；`wgmma.mma_async` 在 SASS 层对应 `GMMA`/`HGMMA`，通过 commit/fence 异步完成机制与 `LDSM` 指令重叠执行。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- FlashAttention-V3's consumer warpgroup uses WGMMA for matmul; gemm1 must have operand A in registers (output C of gemm0) and operand B in shared memory — constraining the pipeline to A-in-register WGMMA forms. Intra-warpgroup GEMM-softmax overlap pipelines EXP (CUDA core, 16 OPS/cycle) with WGMMA (2048 FLOPS/cycle, ~2× faster for headdim=128), so EXP is partially but not fully hidden. — [[2025-05-26-flashattention-v3解读之hopper-gpu版flashatte]]
