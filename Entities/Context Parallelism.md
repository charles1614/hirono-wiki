---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# Context Parallelism

Parallelism strategy that shards the sequence dimension across GPUs for long-context training, assigned to the attention layer group in MoE Parallel Folding's heterogeneous mapping.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- In [[vLLM]], CP splits into two distinct axes: [[Prefill Context Parallelism]] (PCP — adds workers, shards tokens for MoE prefill) and [[Decode Context Parallelism]] (DCP — subdivides TP group, shards KV cache for decode). Both can be combined as a 2D grid. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- [[Megatron-LM]] CP achieves quadratic activation memory reduction (CP²): seq=32K, CP=4 reduces attention elements 16× (1B → 64M). Orthogonal to TP — sequences split across CP ranks, heads split across TP ranks. Hierarchical CP (`--hierarchical-context-parallel-sizes`) supports multi-node deployments with mixed intra/inter-node communication strategies. — [[2026-01-21-deepwiki-megatron-lm-08-context-parallel]]
