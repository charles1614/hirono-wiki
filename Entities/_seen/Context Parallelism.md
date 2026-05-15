---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Context Parallelism

Parallelism strategy that shards the sequence dimension across GPUs for long-context training, assigned to the attention layer group in MoE Parallel Folding's heterogeneous mapping.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- In [[vLLM]], CP splits into two distinct axes: [[Prefill Context Parallelism]] (PCP — adds workers, shards tokens for MoE prefill) and [[Decode Context Parallelism]] (DCP — subdivides TP group, shards KV cache for decode). Both can be combined as a 2D grid. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
