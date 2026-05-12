---
created: 2026-05-11
updated: 2026-05-11
type: entity
refs: 2
tier: active
---

# FlashAttention

The original IO-aware fused attention kernel (Dao et al.); v1/v2/v3; foundation for most modern attention kernel work.

## Synthesis

The IO-aware fused-attention kernel that became the substrate for everything that came after — the canonical reference cited when discussing Hopper-era attention kernel scheduling. **FlashAttention-3** is the explicit comparison point for FlashMLA's seesaw schedule (FA-3 introduced ping-pong scheduling + intra-warpgroup GEMM-softmax pipelining), and FlashMLA acknowledges FlashAttention as one of its primary inspirations alongside Flash-Decoding and CUTLASS. On the Transformer Engine side, **DotProductAttention bypasses FP8 TC** in favor of flash-attention — so attention doesn't actually benefit from FP8 in the standard TE path, per the HKUST Hopper microbench analysis.

## Observations

- Used as the kernel-design reference point for FlashMLA's seesaw schedule. FlashMLA's writeup credits FlashAttention's online softmax + accumulation approach as the algorithmic basis the seesaw schedule extends; FA-3 specifically is the comparison for why the seesaw is needed (FA-3's ping-pong needs two output matrices per SM, blocked by Hopper's register budget for 64×512 MLA outputs). — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- HKUST Hopper microbench finding: Transformer Engine's `DotProductAttention` operator uses flash-attention instead of FP8 Tensor Cores. So attention doesn't get FP8 acceleration in TE — a non-obvious finding that explains why FP8 LLM speedups don't match the 2× peak rates suggest. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
