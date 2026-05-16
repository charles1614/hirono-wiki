---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 5
tier: active
---

# KV Cache

Key-Value cache used during autoregressive LLM inference to avoid recomputing attention keys and values for prior tokens.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- MLA的核心动机是KV Cache的显存占用瓶颈：在decode阶段，使用KV Cache的推理从计算密集型转为访存密集型；显存中KV Cache和模型参数是两大主要消耗，MLA通过低秩压缩将每Token KV从完整16384维压缩至576维，使decode阶段GPU计算-访存比进入compute-bound区间（H800下约242 FLOPs/byte）。 — [[2025-06-05-deepseek技术解读-1-彻底理解mla-multi-head-latent]]
- Standard TP over MLA (`num_kv_heads=1`) causes KV cache to be duplicated `tp_size` times via `QKVParallelLinear`; [[SGLang]]'s [[DP Attention]] solves this by assigning different request batches to each DP worker rather than replicating KV heads. — [[2025-05-27-sglang-dp-attention-介绍]]
- vLLM V1 paged KV cache: the Scheduler in Process 1 manages block allocation via a block manager using free block queues; each block defaults to 16 tokens; block count determined by a dummy forward pass measuring available VRAM before allocating the KV tensor. — [[2025-05-27-vllm-v1-整体流程-从请求到算子执行]]
