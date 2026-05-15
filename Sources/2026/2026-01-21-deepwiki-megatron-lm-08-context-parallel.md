---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/megatron-lm?file=08-context-parallelism
tags: [training, parallelism, long-context, gpu]
---

# [2026-01-21] DeepWiki Megatron-LM — Context Parallelism (08)

## TL;DR

DeepWiki reference for Context Parallelism (CP) in [[Megatron-LM]], which splits the sequence dimension across GPUs to enable very long context training (8K–1M tokens). Covers four communication strategies (P2P ring, All-to-All, AllGather, hybrid), hierarchical CP for multi-node deployments, and quadratic memory savings.

## Key claims

- Context Parallelism splits the sequence dimension across CP_size GPUs; activation memory reduction is quadratic (CP²): at seq=32K with CP=4, attention elements drop from 1B to 64M (16× savings).
- Four communication strategies: P2P ring (memory-efficient, CP sequential steps — best for large CP or very long sequences), All-to-All (parallel exchange, 2-step — best for CP=2–8), AllGather (simplest, highest memory), and hybrid a2a+p2p (A2A for intra-node NVLink, P2P for inter-node InfiniBand — optimal for multi-node).
- Hierarchical CP (`--hierarchical-context-parallel-sizes 2 4`) creates multi-level CP groups; enables total CP=8 across nodes by combining fast intra-node and slower inter-node communication levels.
- CP is orthogonal to Tensor Parallelism: sequence splits across CP ranks while heads split across TP ranks; example CP=4, TP=8, 32 heads, 32K sequence gives each GPU 8K tokens and 4 heads.
- Recommended use when sequence length ≥ 8K tokens; typical values CP=2, 4, 8 (powers of 2); CP ≤ GPUs per node to leverage NVLink bandwidth.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Megatron-LM]], [[Megatron-Core]], [[NCCL]]

## Topics touched

[[Context Parallelism]], [[Tensor Parallelism]], [[Parallelism Strategies]], [[LLM Training Systems]]

## Raw source

[wiki.litenext.digital/wiki/megatron-lm](https://wiki.litenext.digital/wiki/megatron-lm?file=08-context-parallelism) — DeepWiki auto-generated Megatron-LM doc; source commit dd7c9f4f6; generated December 29, 2025. Read 2026-05-15.
