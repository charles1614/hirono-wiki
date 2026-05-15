---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Chunked Prefill

vLLM feature splitting long prompt prefill into bounded-size chunks to reduce latency spikes

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- vLLM V1 Chunked Prefill: 将超长 prompt 分割为不超过 `long_prefill_token_threshold` 的块，避免单请求独占一个 engine step 而推迟其他请求的 TTFT；即使未设置阈值，当 prompt 超过 token budget 时也会自动触发 chunked prefill。 — [[2025-09-04-inside-vllm-anatomy-of-a-high-throughput]]
