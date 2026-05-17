---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/megatron-lm?file=12-attention-mechanisms
tags: [training, attention-kernels, parallelism, gpu]
---

# [2026-01-21] DeepWiki Megatron-LM — Attention Mechanisms (12)

## TL;DR

DeepWiki reference for [[Megatron-LM]]'s attention implementation, covering MHA, GQA, MLA, FlashAttention integration, RoPE, and multiple backend options. Includes architecture diagrams, implementation code from `megatron/core/transformer/attention.py`, and a comparison table of attention backends by memory/speed.

## Key claims

- [[Megatron-LM]] supports four attention variants: standard MHA, [[GQA]] (Grouped-Query Attention, 4–8× KV cache reduction as in Llama-3), MLA (Multi-Latent Attention from DeepSeek-V3, 16× vs MHA by caching compressed latents), and FlashAttention.
- [[FlashAttention]] reduces attention memory from O(N²) to O(N) by tiling computations in SRAM; example: batch=8, heads=32, seq=2048 drops from 2.1 GB to 134 MB (16× savings).
- MLA (used by [[DeepSeek-V3]]) compresses KV cache to a lower-dimensional latent space; example shows 65 MB per layer vs 256 MB for GQA at 128K sequence length (4× beyond GQA, 16× vs MHA).
- Backend selection supports flash_attn (fastest, O(N) memory), Transformer Engine (FP8), cuDNN SDPA (PyTorch 2.0+), Triton (custom), and native PyTorch (fallback); configured via `attention_backend` in `TransformerConfig`.
- [[RoPE]] (Rotary Position Embeddings) applies rotation to Q and K based on position, enabling relative position information and sequence-length extrapolation without learned embeddings.
- Tensor parallelism distributes attention heads across GPUs via column-parallel QKV projection and row-parallel output projection, with AllReduce at the output.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Megatron-LM]], [[FlashAttention]], [[GQA]], [[RoPE]], [[MLA]], [[DeepSeek-V3]], [[Megatron-Core]]

## Topics touched

[[Attention Kernels]], [[Context Parallelism]], [[Tensor Parallelism]], [[LLM Training Systems]], [[KV Cache Management]]

## Raw source

[wiki.litenext.digital/wiki/megatron-lm](https://wiki.litenext.digital/wiki/megatron-lm?file=12-attention-mechanisms) — DeepWiki auto-generated Megatron-LM doc; source commit dd7c9f4f6; generated December 29, 2025. Read 2026-05-15.
