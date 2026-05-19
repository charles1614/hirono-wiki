---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/BalV_qPfwiIwDMEnNI_O3Q
tags: [model-training, distributed-systems, long-context, blog-post]
---

# [2025-11-03] 超长序列并行之Ulysses + Ring-Attention技术原理与实现

## TL;DR

ModelScope/SWIFT team explains the theory and implementation of combining [[Ulysses]] and [[Ring-Attention]] for long-sequence training, achieving up to 4.2× memory reduction on Qwen2.5-3B at 65,536-token sequences with 8×A100 using SP=8, with detailed derivation of the online-softmax update equations and engineering solutions for multimodal and padding-free inputs.

## Key claims

- Ulysses (DeepSpeed) all-to-all exchanges activations before attention so each GPU holds the full sequence but only a subset of attention heads; complexity is O(N²) per head but memory decreases with head count; limited by number of KV heads in GQA settings.
- [[Ring-Attention]] partitions the sequence across GPUs in a ring topology, passing KV blocks P2P; each GPU accumulates a running (LSE, Attention-Out) via the online-softmax recurrence identical to FlashAttention's block update: `LSE_new = LSE_i + log(1 + exp(LSE_ij − LSE_i))`, `Out_new = sigmoid(LSE_i − LSE_ij)·Out_i + sigmoid(LSE_ij − LSE_i)·Out_ij`.
- Zigzag (z-shaped) chunk assignment pairs chunk 0 with chunk 7, chunk 1 with chunk 6, etc. to equalize causal-mask compute load across ranks, eliminating the load imbalance of naive ring where GPU 0 never uses late KV blocks.
- Fusing Ulysses (world_size=2) + Ring-Attention (world_size=4) at SP=8 reduces memory from 75.35 GiB (no SP) to 17.92 GiB while training time increases from ~20 min to ~67 min due to communication overhead.
- SWIFT implements SP in a backbone forward hook (not data collator) so multimodal models are automatically compatible after ViT encoding replaces placeholder tokens with actual embeddings.
- For padding-free (flash-attn packed) inputs: per-sequence padding to `world_size×2`, zero-masking Q/V padding and setting K padding to near-negative-infinity before attention, and rewriting loss computation to avoid logits gather mid-sequence.
- Backward recomputes flash_attn_forward to retrieve block LSE and Attention-Out rather than saving them in ctx, trading compute for memory.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现/weixin-img-004.png)

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现/weixin-img-008.png)

*Other images decorative — SVG math formulas rendered as diagrams, sequence diagrams, memory benchmark tables.*

## Entities touched

[[Ulysses]], [[Ring-Attention]], [[Sequence Parallelism]], [[FlashAttention]], [[DeepSpeed]]

## Topics touched

[[Sequence Parallelism]], [[LLM Training Systems]], [[Context Parallelism]]

## Raw source

[mp.weixin.qq.com/s/BalV_qPfwiIwDMEnNI_O3Q](https://mp.weixin.qq.com/s/BalV_qPfwiIwDMEnNI_O3Q) — WeChat public account "魔搭ModelScope社区", published 2025-11-03. Read 2026-05-15.
