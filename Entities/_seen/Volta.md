---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Volta

NVIDIA GPU architecture (2017) — introduced the first Tensor Cores (FP16/FP32 MMA).

## Observations

- Volta（1st gen TC，Tesla V100，2017）每 SM 8 个 Tensor Core，MMA 作用域为 8 线程 quadpair，执行 8×8×4 矩阵乘（1024 FLOPs/cycle/SM）；HMMA 指令引入动机是摊销每条指令 ~30pJ 发射开销（vs HFMA 1.5pJ，20× 差）；Tensor Core 在 Volta 架构设计末期（离 tape out 仅几个月）加入，体现 NVIDIA 快速响应市场的能力。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
