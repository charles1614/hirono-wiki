---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/NYzWq4ZOmT0n5mamwmNpPg
tags: [inference, kv-cache, disaggregation, gpu]
---

# [2025-12-04] 突破显存瓶颈：基于 DeepSeek-V3.2-Exp 的 Latent Cache 卸载预取方案设计与模拟验证

## TL;DR

Baidu AIAK team proposes Expanded Sparse Server (ESS): a Latent Cache offload-prefetch scheme for [[DeepSeek-V3]] (V3.2-Exp) in PD-disaggregated deployment under [[SGLang]], validated via a high-fidelity simulator. ESS offloads Latent Cache to CPU memory, recovering GPU VRAM to support larger batch sizes, and contributes up to 123% throughput gain at 128K context.

## Key claims

- At 32K context, GPU VRAM limits batch size to ≤52, capping throughput at 9,647 tokens/s; GPU remains compute-underutilized.
- DeepSeek-V3.2-Exp Latent Cache exhibits high temporal locality both intra-layer and inter-layer (measured via Jaccard similarity on LongBench-v2), making CPU offload viable.
- Each Latent Cache entry is only 656 bytes; `cudaMemcpyAsync` achieves only 0.79 GB/s H2D and 0.23 GB/s D2H for these scatter accesses. ESS's **FlashTrans** CUDA operator (UVA-based, address-driven) achieves 37 GB/s H2D and 43 GB/s D2H.
- Indexer Cache (16.8% of total) requires full-attention computation and is kept on GPU; only Latent Cache is offloaded.
- LRU-Warmup initializes the GPU Sparse Memory Pool from the last 32 Prefill windows' Top-2K Latent Cache indices, significantly reducing early Decode Cache Miss.
- **DA Overlap** splits SparseMLA into Attn0 (uses cached entries) + Attn1 (awaits H2D), hiding transfer behind computation. **DBA Overlap** further splits Indexer along the batch dimension for long-context scenarios.
- Minimum recommended Sparse Memory Pool size: 6,400 slots, keeping average Cache Miss below 200 and ensuring transfer delay is fully overlapped.
- Simulator results: at MTP=4 (acceptance 3.4x), 32K context, ESS contributes 70.2% throughput gain on top of MTP's 53.1%. At MTP=2, 128K context, ESS alone delivers 123% throughput improvement.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-12-04-突破显存瓶颈-基于-deepseek-v3-2-exp-的-latent-cac/weixin-img-007.png)

![](../../raw/raindrop/mp.weixin.qq.com/2025-12-04-突破显存瓶颈-基于-deepseek-v3-2-exp-的-latent-cac/weixin-img-014.png)

*Other images decorative — throughput curves, Cache Miss statistics, overlap timeline comparisons.*

## What this changes

Demonstrates that CPU offload of sparse attention's Latent Cache is practical at industrial scale given sufficient temporal locality and a purpose-built CUDA transport operator, extending batch sizes without accuracy loss.

## Entities touched

[[DeepSeek-V3]], [[SGLang]]

## Topics touched

[[KV Cache Management]], [[Inference Disaggregation]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/NYzWq4ZOmT0n5mamwmNpPg](https://mp.weixin.qq.com/s/NYzWq4ZOmT0n5mamwmNpPg) — Baidu AIAK team WeChat article; published 2025-12-04. Read 2026-05-15.
