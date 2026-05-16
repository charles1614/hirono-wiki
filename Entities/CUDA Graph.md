---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# CUDA Graph

CUDA mechanism for recording and replaying a fixed sequence of kernel launches, eliminating per-launch CPU overhead.

## Observations

- Applied as Optimization 5 for MLA decode: during decode, only batch size changes between steps (sequence length is fixed), making the graph capturable; eliminates kernel-launch and operator-dispatch overhead alongside `torch.compile`; expected to provide further speedup on top of matrix absorption + FlashMLA + CUTLASS FP8. — [[2025-06-16-细数deepseek-mla-layer从naive实现开始的5大优化策略]]
