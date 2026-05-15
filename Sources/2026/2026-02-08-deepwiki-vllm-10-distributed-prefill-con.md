---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/vllm?file=10-distributed#prefill-context-parallelism-pcp
tags: [inference, parallelism, long-context]
---

# [2026-02-08] DeepWiki vLLM — Distributed Architecture / Prefill Context Parallelism (PCP)

## TL;DR

DeepWiki code-derived documentation of [[vLLM]]'s distributed architecture chapter (source commit 4061dcf4c), covering all six parallelism types with emphasis on the two Context Parallelism variants: **Prefill Context Parallelism (PCP)** — splits input tokens across ranks for MoE-layer long-context prefill using AllGather + ReduceScatter — and **Decode Context Parallelism (DCP)** — subdivides the TP group to shard the KV cache across ranks during decoding, combining partial attentions with LSE.

## Key claims

- **Six parallelism types in vLLM**: TP (wide layers), PP (deep models), EP (MoE experts), DP (throughput), PCP (long-context MoE prefill), DCP (long-context decode). World size = `PP × TP × PCP`; DCP does NOT add workers — it subdivides the TP group.
- **PCP is MoE-only today.** PCP is active only in MoE layers (AllGather hidden states → redundant router select on all ranks → each rank runs its local expert shard → ReduceScatter). All attention backends set `supports_pcp = False` (`vllm/v1/attention/backend.py:615`); enabling PCP with an attention layer asserts at validation time.
- **PCP token interleaving**: tokens distributed by position modulo `pcp_world_size` (even positions to rank 0, odd to rank 1, etc.). AllGather before routing is required to ensure globally consistent Top-K decisions — per-rank routing with partial tokens would cause expert load imbalance.
- **PCP flattens into the EP/TP dimension** for expert weight sharding: `flatten_tp_rank = dp_rank * pcp_size * tp_size + pcp_rank * tp_size + tp_rank`. With PCP=2, TP=2, 64 experts: rank 0 holds experts 0–15, rank 1 holds 16–31, rank 2 holds 32–47, rank 3 holds 48–63. PCP delivers real expert-shard parallelism, not just sequence sharding.
- **EP group spans DP × PCP × TP**: `EP_group_size = dp_size × pcp_size × tp_size`. In the common single-replica case (DP=1, PCP=1), EP and TP are the same ranks; PCP causes EP to grow larger.
- **DCP subdivides TP** — `TP % DCP == 0` required. Each DCP rank stores 1/DCP of the KV tokens (interleaved). Decode step: AllGather Q heads across DCP group (dim=1), each rank runs `flash_attn_varlen_func` against local KV only, then LSE-based combination (`logsumexp` across partial results) + ReduceScatter back.
- **DCP enables 4× KV memory reduction** at TP=8, DCP=4: each GPU holds `1 KV head × N/4 tokens` vs `1 KV head × N tokens` without DCP — enabling 4× longer contexts on the same hardware, at the cost of additional AllGather Q + AllGather LSE + ReduceScatter communication rounds.
- **LSE combination is mathematically exact**: `LSE_total = logsumexp(LSE_0, LSE_1, …)`, `Output = Σ(exp(LSE_i − LSE_total) × Output_i)`. Not an approximation — produces identical results to full-sequence attention.
- **PCP and DCP can combine** into a 2D grid: `total_cp_world_size = pcp_world_size × dcp_world_size`. Designed for MoE models with long prompts AND long generation: use PCP during prefill, DCP during decode, together for both.
- **When to use each** (table from doc): MoE + long prompt + short gen → PCP only; any model + short prompt + long context gen → DCP only; MoE + both → PCP+DCP; dense + long prompt → DCP only (PCP inapplicable); standard <32K context → neither.
- **PCP limitations (current)**: no sliding window attention, no chunked local attention, no Mamba (`pcp_world_size == 1` asserts in `single_type_kv_cache_manager.py`).

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

- **Names and specifies the PCP mechanism** as distinct from CPP (Chunked Pipeline Parallelism, a different technique): CPP overlaps PP stages to reduce FTL without wide TP; PCP shards tokens and expert weights across new workers. Both target long-context MoE prefill but via orthogonal mechanisms — CPP from disaggregated serving research ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]), PCP from vLLM's in-engine parallelism registry.
- **Pins the current PCP implementation gap**: attention-layer PCP is infrastructure-ready (rank/size tracking in `AttentionImplBase`) but not yet implemented — all current backends return `supports_pcp = False`. This is the load-bearing gap between the theoretical 6-parallelism model and current deployment.
- **Clarifies DCP's key trade-off**: it is a KV memory reduction strategy first (up to 4× at DCP=4), latency optimization second — it adds multiple communication rounds vs DCP=1.

## Entities touched

[[vLLM]], [[Prefill Context Parallelism]], [[Decode Context Parallelism]], [[Context Parallelism]], [[Expert Parallelism]], [[MoE]], [[NCCL]], [[FlashAttention]]

## Topics touched

[[LLM Inference Systems]], [[Parallelism Strategies]], [[Inference Disaggregation]]

## Raw source

[wiki.litenext.digital/wiki/vllm?file=10-distributed](https://wiki.litenext.digital/wiki/vllm?file=10-distributed#prefill-context-parallelism-pcp) — DeepWiki code-derived doc · vLLM source commit 4061dcf4c · 57 KB · 13 mermaid diagrams spliced · 57 code fences · 111 tables. Captured 2026-05-10.
