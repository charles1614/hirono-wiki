---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 4
tier: active
---

# Volta

NVIDIA GPU architecture (2017) — introduced the first Tensor Cores (FP16/FP32 MMA).

## Synthesis


NVIDIA's Volta is the first-generation Tensor Core architecture (Tesla V100, 2017) — each SM has 8 Tensor Cores at 8-thread quadpair scope performing 8×8×4 matrix multiplies for 1024 FLOPs/cycle per SM. The introduction of HMMA was motivated by amortizing the ~30 pJ per-instruction emission overhead — versus 1.5 pJ for HFMA, a 20× gap — making per-instruction setup the dominant energy cost without Tensor Core consolidation. Volta's Tensor Core itself was added in the architecture's late design phase, only months before tape-out, reflecting NVIDIA's ability to respond rapidly to emerging market demand. Limited corpus evidence beyond this architectural-history role — Volta functions primarily as the historical anchor point in cross-generation Tensor Core evolution surveys, with subsequent generations measured against Volta's 1024 FLOPs/cycle/SM baseline and 8-thread quadpair MMA scope.


## Observations

- Volta（1st gen TC，Tesla V100，2017）每 SM 8 个 Tensor Core，MMA 作用域为 8 线程 quadpair，执行 8×8×4 矩阵乘（1024 FLOPs/cycle/SM）；HMMA 指令引入动机是摊销每条指令 ~30pJ 发射开销（vs HFMA 1.5pJ，20× 差）；Tensor Core 在 Volta 架构设计末期（离 tape out 仅几个月）加入，体现 NVIDIA 快速响应市场的能力。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
