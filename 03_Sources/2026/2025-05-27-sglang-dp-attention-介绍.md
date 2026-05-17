---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/1907142274942501938
tags: [inference-serving, distributed-systems, source-shape/blog, llm-inference]
---

# [2025-05-17] SGLang DP Attention 介绍

## TL;DR

A detailed technical walkthrough of SGLang's DP Attention mechanism, explaining why standard tensor parallelism wastes memory on MLA (num_kv_heads=1) and how data-parallel attention solves it by sharding requests rather than KV heads, achieving up to 1.9× decoding throughput improvement in high-batch scenarios.

## Key claims

- [[MLA]] has `num_kv_heads=1`; with TP over 8 GPUs, `QKVParallelLinear` sets `num_kv_head_replicas = tp_size / total_num_kv_heads`, causing KV cache to be duplicated `tp_size` times — wasting memory proportionally to TP degree.
- [[DP Attention]] assigns each DP worker an independent batch subset (prefill/decode/idle); workers process attention independently, then all-gather hidden states before the [[MoE]] layer, and scatter back after MoE.
- Initial PR #1970 implementation required `DP_SIZE == TP_SIZE`; current SGLang supports `1 < DP_SIZE ≤ TP_SIZE` and `MOE-DENSE-TP-SIZE=[1, None]`.
- Same KV duplication problem applies to Qwen3-235B-A22B (`num_key_value_heads=4`) at large TP; [[SGLang]] extended DP Attention support to Qwen3-MoE (PR #6121).
- Optimization is suited for large-batch, KV-cache-constrained throughput maximization; explicitly not recommended for low-latency, small-batch scenarios.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[SGLang]], [[MLA]], [[MoE]], [[DP Attention]], [[Qwen]], [[DeepSeek-V3]], [[KV Cache]]

## Topics touched

[[LLM Inference Systems]], [[Parallelism Strategies]], [[MoE Serving]], [[KV Cache Management]]

## Raw source

[zhuanlan.zhihu.com/p/1907142274942501938](https://zhuanlan.zhihu.com/p/1907142274942501938) — Zhihu article, author: 楊yyy, published 2025-05-17. Read 2026-05-16.
