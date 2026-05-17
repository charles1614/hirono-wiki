---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/megatron-lm?file=13-feedforward-networks
tags: [training, parallelism, gpu]
---

# [2026-01-21] DeepWiki Megatron-LM — Feedforward Networks (13)

## TL;DR

DeepWiki reference for the MLP block in [[Megatron-LM]], covering standard FC1→Activation→FC2, GLU variants (SwiGLU, GEGLU), tensor-parallelism sharding, fused kernel optimizations, and activation checkpointing. MLP comprises ~2/3 of both parameters and compute in large transformers.

## Key claims

- Standard transformer MLP is FC1 (H → 4H) + activation + FC2 (4H → H), totaling 8H² parameters; for GPT-3 175B (H=12288) this is 1.2B parameters per layer and 115B of the 175B total (66%).
- SwiGLU (Swish-Gated Linear Unit) is the modern standard (Llama, PaLM): FC1 produces 2× output split into gate and input, gate passes through SiLU, element-wise multiply — requires 12H² parameters but models compensate with smaller FFN (Llama-3 70B uses 2.75H giving comparable net count).
- Tensor parallelism applies column-parallel FC1 (no AllReduce) + row-parallel FC2 (AllReduce at output); with TP=4 on GPT-3: 1.2B parameters per GPU reduces to 302M parameters (4× reduction, 2.4 GB → 604 MB FP16).
- Fused bias+activation kernels (e.g., `FusedBiasSwiGLU`) reduce HBM reads/writes from 3 to 1, achieving 15–20% speedup for small tensors.
- Activation checkpointing saves ~60–63% of MLP activation memory by recomputing FC1 output during backward; example: batch=4, seq=2048, H=8192 drops from 738 MB to 268 MB.
- MLP FLOPs per token dominate over attention at long sequences: Llama-3 70B MLP is 75B FLOPs/token vs ~3B for attention at seq=2048 (25× ratio).

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Megatron-LM]], [[Megatron-Core]], [[MoE]]

## Topics touched

[[Tensor Parallelism]], [[LLM Training Systems]], [[LLM Pretraining]]

## Raw source

[wiki.litenext.digital/wiki/megatron-lm](https://wiki.litenext.digital/wiki/megatron-lm?file=13-feedforward-networks) — DeepWiki auto-generated Megatron-LM doc; source commit dd7c9f4f6; generated December 29, 2025. Read 2026-05-15.
