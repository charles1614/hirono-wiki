---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.aleksagordic.com/blog/vllm
tags: [inference, kv-cache, scheduling, disaggregation, speculative-decoding]
---

# [2025-09-04] Inside vLLM: Anatomy of a High-Throughput LLM Inference System

## TL;DR

Aleksa Gordić提供 vLLM V1 引擎的深度逐层解剖，覆盖从 LLM Engine 构造、调度器、KV Cache 管理、Paged Attention、连续批处理，到 Chunked Prefill、Prefix Caching、Speculative Decoding、PD 分离等高级特性，基于 commit 42172ad（2025-08-09）。

## Key claims

- vLLM V1 Engine 的核心组件：Processor（tokenization）、EngineCore（含 Scheduler + KV Cache Manager + Model Executor）、OutputProcessor；Scheduler 维护 waiting/running 两队列，支持 FCFS 或 priority 策略。
- KV Cache Manager 维护 `free_block_queue`（数十万 block 的链表）；每个 block 默认存 16 个 token，block 大小 = 2 × block_size × num_kv_heads × head_size × dtype_bytes；init KV cache 阶段通过 dummy forward pass 计算可用 VRAM 后分配。
- 连续批处理（continuous batching）通过将所有序列展平拼接为单一"超序列"（super sequence），用 position index 和 attention mask 保证每序列仅 attend 自身 token，无需右 padding；V1 引擎每次 step 可混合 prefill 和 decode 请求。
- [[Chunked Prefill]] 将超长 prompt 分成不超过 `long_prefill_token_threshold` 的块分批处理，避免单个长请求独占 step 拖慢其他请求的 TTFT。
- [[Prefix Caching]] 对完整 block（16 tokens）计算基于前一 block hash + token ids + 可选 LoRA ID 的哈希，命中后直接重用已缓存的 KV block，无需重新计算 prefix；仅整块可缓存，不完整块（`prefix_len % block_size != 0`）须重算。
- Worker 初始化 3 步：init device（分配 CUDA 设备/设置 TP/PP 等）→ load model（load weights + `model.eval()` + 可选 `torch.compile`）→ init KV cache（profiling forward pass + 分配 KV tensor + 捕获 CUDA Graph）。

## Visual observations

![](../../raw/raindrop/www.aleksagordic.com/2025-09-04-inside-vllm-anatomy-of-a-high-throughput/aleksagordic-img-001.png)

![](../../raw/raindrop/www.aleksagordic.com/2025-09-04-inside-vllm-anatomy-of-a-high-throughput/aleksagordic-img-004.png)

![](../../raw/raindrop/www.aleksagordic.com/2025-09-04-inside-vllm-anatomy-of-a-high-throughput/aleksagordic-img-003.png)

*Other images decorative — engine loop diagrams and additional feature schematics redundant with body text above.*

## Entities touched

[[vLLM]], [[PagedAttention]], [[Chunked Prefill]], [[Prefix Caching]], [[KV Cache]], [[Inference Disaggregation]], [[Speculative Decoding]], [[CUDA Graph]], [[Aleksa Gordić]]

## Topics touched

[[LLM Inference Systems]], [[KV Cache Management]], [[Speculative Decoding]]

## Raw source

[aleksagordic.com/blog/vllm](https://www.aleksagordic.com/blog/vllm) — Aleksa Gordić personal blog, 2025-09-04. Read 2026-05-15.
