---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Prefix Caching

Optimization that reuses KV-cache from shared prompt prefixes across requests; one of the four core features implemented in Nano-vLLM alongside paged attention, tensor parallelism, and CUDA graphs.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- vLLM V1 Prefix Caching 实现：对每个完整 block（默认 16 tokens）基于（前一 block hash + 当前 token ids + 可选 LoRA ID/cache salt）计算 BlockHash，命中 `cached_block_hash_to_block` 后直接复用 KV block；不完整 block（`prefix_len % block_size != 0`）必须重新计算，不可缓存。仅加速 prefill，不影响 decode。 — [[2025-09-04-inside-vllm-anatomy-of-a-high-throughput]]
