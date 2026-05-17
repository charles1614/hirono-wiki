---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 7
tier: active
---

# DP Attention

data-parallel attention mechanism for MLA in SGLang that eliminates KV cache duplication across TP ranks

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[SGLang]] DP Attention for [[MLA]] (`num_kv_heads=1`): TP with `tp_size > 1` duplicates KV cache `tp_size` times (via `QKVParallelLinear` replica logic); DP Attention instead assigns different request batches to each DP worker, all-gathers hidden states before [[MoE]] layers, and scatters back after MoE — achieving up to 1.9× decoding throughput at high-batch KV-cache-constrained workloads. — [[2025-05-27-sglang-dp-attention-介绍]]
- SGLang DP Attention was introduced in PR #1970 requiring DP_SIZE == TP_SIZE; extended to support `1 < DP_SIZE ≤ TP_SIZE` and `MOE-DENSE-TP-SIZE=[1, None]`; applied to Qwen3-235B-A22B (num_kv_heads=4) via PR #6121; not recommended for low-latency small-batch scenarios. — [[2025-05-27-sglang-源码学习笔记-三-分布式和并行-以deepseek-为例-wip]]
