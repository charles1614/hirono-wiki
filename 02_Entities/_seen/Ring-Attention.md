---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Ring-Attention

Sequence parallelism technique partitioning sequences across GPUs using ring-topology P2P communication

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Ring-Attention partitions the sequence across GPUs in a ring, propagating KV blocks P2P; each GPU accumulates a running (LSE, Attention-Out) via online-softmax: `LSE_new = LSE_i + log(1 + exp(LSE_ij − LSE_i))`; zigzag assignment (chunk 0 paired with chunk 7, etc.) equalizes causal-mask compute load. In SWIFT, combining Ulysses (world_size=2) + Ring-Attention (world_size=4) at SP=8 reduces memory from 75.35 GiB to 17.92 GiB for 65K-token Qwen2.5-3B training on 8×A100. — [[2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现]]
