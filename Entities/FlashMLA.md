---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 2
tier: active
---

# FlashMLA

DeepSeek's MLA-decoding attention kernel for H100/H800; second-generation hits ~660 TFlops via "seesaw" scheduling.

## Synthesis

DeepSeek's MLA-decoding attention kernel for Hopper. **The seesaw-schedule deep-dive** is the canonical writeup: MLA decoding is compute-bound on H800 (because DeepSeek doesn't TP decode → `h_q × s_q ≥ 128`), so the kernel can't use FlashAttention-3's ping-pong with two output buffers — the 64×512 output matrix consumes 32,768 of an SM's 65,536 registers. Solution: vertical-split the output (O_L / O_R) and rotate between two warpgroups on alternating KV blocks (the "seesaw"). Reaches ~80% Tensor Core utilization, 3 TB/s memory bandwidth, 660 TFlops on H800 SXM5 (up from 580 in the prior version).

## Observations

- Second-generation kernel hits **660 TFlops on H800 SXM5** (up from 580 in the prior version). Achieves ~80% Tensor Core utilization vs the throttled ~865 TFlops practical peak. The seesaw schedule is the load-bearing trick: 12-step interleaving across two warpgroups operating on alternating KV blocks K0/K1 with vertically-split output O_L/O_R, plus fine-grained TMA-GEMM pipelining (9 64×64 TMA copies per 64×576 K-block) and `EVICT_FIRST` cache hints. Acknowledged inspirations: FlashAttention's online softmax, Flash-Decoding's split-K, CUTLASS tile-scheduling primitives. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
