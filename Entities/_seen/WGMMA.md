---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# WGMMA

Hopper+ instruction for async warpgroup-level matrix multiply; cornerstone of FlashAttention-3 + FlashMLA.

## Synthesis

*Regenerated from Observations below.*

## Observations

- `wgmma`（warpgroup-level MMA）是 Hopper 引入的 4th gen TC 指令，128 线程 warpgroup 共同执行，操作数 B 直接从 SMEM 读（无需先加载到 register），支持形状 `m64nNk16`（N 可为 8–256 的倍数，远超 Ampere 的 `m16n8k16`）；`wgmma.mma_async` 在 SASS 层对应 `GMMA`/`HGMMA`，通过 commit/fence 异步完成机制与 `LDSM` 指令重叠执行。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
