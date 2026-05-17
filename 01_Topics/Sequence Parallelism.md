---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 1
---

# Sequence Parallelism

## What

Techniques for distributing long input sequences across GPUs during LLM training to reduce per-device memory

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Sources drawn on

- [[2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现]] — Full derivation of Ulysses + Ring-Attention fusion in SWIFT, with memory benchmarks showing 4.2× reduction at SP=8 on Qwen2.5-3B at 65K tokens.
