---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 7
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
- KV cache size reduction is the dominant motivation for 2026 open-weight architecture tweaks. Approaches surveyed: (1) [[Cross-Layer Attention]] — later layers reuse earlier layers' KV (Gemma 4); (2) per-token representation compression — [[MLA]]; (3) latent-space attention — [[Compressed Convolutional Attention]] (ZAYA1-8B); (4) sequence-dimension compression — [[Compression Sparse Attention]] / [[Highly Compressed Attention]] (DeepSeek-V4). DeepSeek V4-Flash hits 7% of V3.2 KV cache size at 1M context. — [[2026-05-17-recent-developments-in-llm-architectures]]
