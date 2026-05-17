---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# Decode Context Parallelism

DCP — vLLM inference parallelism strategy for long-context decode; subdivides TP group to shard KV cache across ranks with LSE-combined attention

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DCP **subdivides the TP group** (does not add workers; requires `TP % DCP == 0`). Each DCP rank stores 1/DCP of KV tokens (interleaved by position). — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- Decode communication: AllGather Q heads across DCP group (dim=1) → each rank runs FlashAttention against local KV only → LSE-based combination (mathematically exact: `LSE_total = logsumexp(LSE_0, LSE_1, …)`, `Output = Σ(exp(LSE_i − LSE_total) × Output_i)`) → ReduceScatter output on dim=1. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- At TP=8, DCP=4: KV memory per GPU drops from `1 KV head × N tokens` to `1 KV head × N/4 tokens` — **4× KV memory reduction**, enabling 4× longer contexts on the same hardware. Trade-off: additional AllGather Q + AllGather LSE + ReduceScatter rounds add communication latency. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- Can be combined with [[Prefill Context Parallelism]] (PCP) for [[MoE]] models that have both long prompts and long context generation: `total_cp_world_size = pcp_world_size × dcp_world_size`. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
