---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/megatron-lm?file=05-tensor-parallelism
tags: [training, parallelism, gpu, tooling]
---

# [2026-01-28] Megatron-LM Tensor Parallelism (DeepWiki doc 05)

## TL;DR

DeepWiki-generated reference for [[Megatron-LM]]'s tensor parallelism implementation: column/row-parallel linear layers, attention head sharding, GLU/SwiGLU MLP sharding, sequence parallelism, communication patterns, memory analysis, and configuration. Practical reference including full code examples and Llama-3 70B walkthrough.

## Key claims

- [[Megatron-LM]] implements TP via two layer types: `ColumnParallelLinear` shards the output dimension (`W[H, F]` → each GPU holds `W[H, F/TP]`), does an AllGather only if `gather_output=True`; `RowParallelLinear` shards the input dimension and always does an AllReduce after local GEMM. Column → Row pairing requires zero inter-layer communication (sharded output matches sharded input expectation).
- Multi-head attention with TP=4 on a 16-head model: each GPU holds 4 heads. QKV projection is column-parallel; attention is fully local; output projection is row-parallel with AllReduce. Total: 3 AllReduces per transformer layer in the forward+backward passes (forward: 1; backward: 2).
- Sequence Parallelism (SP) distributes LayerNorm and Dropout along the sequence dimension — each GPU holds `[B, S/TP, H]` before/after attention — reducing LayerNorm/Dropout activations by 1/TP. Adds AllGather before attention and ReduceScatter after; activation memory reduction ~30% at TP=8.
- Parameter memory scales as P/T (parameters divided by TP degree). For Llama-3 70B at TP=4: 17.5B parameters per GPU = 35 GB FP16 + 210 GB optimizer state (AdamW) before ZeRO sharding.
- Communication overhead example: at batch=4, seq=2048, hidden=8192, BF16 → each AllReduce transfers 268 MB; with TP=8 + 3 AllReduces/layer + 80 layers → 64 GB total per iteration at ~160 ms on 400 GB/s NVLink.
- TP should stay within the NVLink domain (intra-node): NVLink bandwidth ~400 GB/s vs. InfiniBand ~25 GB/s = 16× gap. Cross-node TP at TP=16 runs at ~40% efficiency. Typical recommended values: TP=1 for ≤13B models; TP=4 or TP=8 for 70B; TP=8 + PP for 175B+. Always enable SP when TP > 1.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Megatron-LM]], [[Llama]], [[CUDA]], [[PyTorch]], [[NVLink]]

## Topics touched

[[Tensor Parallelism]], [[Parallelism Strategies]], [[LLM Training Systems]], [[GPU Memory Management]]

## Raw source

[wiki.litenext.digital/wiki/megatron-lm?file=05-tensor-parallelism](https://wiki.litenext.digital/wiki/megatron-lm?file=05-tensor-parallelism) — DeepWiki-generated architecture doc, Megatron-LM commit dd7c9f4f6, generated 2025-12-29. Read 2026-05-15.
