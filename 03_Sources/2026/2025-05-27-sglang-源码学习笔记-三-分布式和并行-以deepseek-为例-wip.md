---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/1890082781461207006
tags: [inference-serving, distributed-systems, source-shape/blog, llm-inference]
---

# [2026-01-25] SGLang 源码学习笔记（三）- 分布式和并行（以DeepSeek为例）

## TL;DR

A deep source-level walkthrough of SGLang's two-layer distributed communication stack — ZMQ-based IPC between tokenizer/scheduler/detokenizer processes, and torch.dist-based TP/DP/EP parallelism for GPU-level tensor operations — using [[DeepSeek-V3]] as the reference model. The prefill-decode (PD) disaggregation path is explicitly deferred as future work.

## Key claims

- [[SGLang]] uses two distinct communication layers: (1) ZMQ socket IPC for process-level coordination (tokenizer↔scheduler↔detokenizer), and (2) `torch.dist` (NCCL) for GPU-parallel TP/DP/EP collective operations.
- ZMQ uses PUSH/PULL socket pairs; only `attn_tp_rank==0` scheduler participates in ZMQ; other ranks learn requests via `torch.dist` from rank 0.
- HTTPServer and tokenizer run in the same process (ordinary function calls, no ZMQ); `_launch_subprocesses` spawns scheduler as `mp.Process` × tp_rank_nums plus one detokenizer process.
- TP communication uses standard all-reduce over NCCL; DP attention workers independently handle prefill/decode/idle batches then all-gather before [[MoE]] layers, and scatter back after MoE (enabling [[DP Attention]] for [[MLA]] with `num_kv_heads=1`).
- PD disaggregation (prefill-decode separation) cannot use gloo/NCCL for online auto-scaling; requires a third transport layer beyond ZMQ and torch.dist.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[SGLang]], [[DeepSeek-V3]], [[MLA]], [[MoE]], [[DP Attention]], [[DeepEP]], [[NVSHMEM]]

## Topics touched

[[LLM Inference Systems]], [[Parallelism Strategies]], [[Expert Parallelism]], [[Inference Disaggregation]]

## Raw source

[zhuanlan.zhihu.com/p/1890082781461207006](https://zhuanlan.zhihu.com/p/1890082781461207006) — Zhihu article, author: 进击的Bruce, published 2026-01-25. Read 2026-05-16.
