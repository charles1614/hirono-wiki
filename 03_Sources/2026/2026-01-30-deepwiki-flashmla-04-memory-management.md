---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/flashmla?file=04-memory-management
tags: [inference, kv-cache, quantization, gpu, long-context]
---

# [2026-01-30] FlashMLA Memory Management and Optimization (DeepWiki doc 04)

## TL;DR

DeepWiki-generated reference for FlashMLA's memory management layer: FP8 KVCache formats (V32 and MODEL1), distributed shared memory (DSM) crossover technique, split-KV processing, TMA pipelining, and paged KVCache layout. Documents how these techniques together enable 128K+ context on single GPUs.

## Key claims

- The FP8 V32 format stores each KVCache token in 656 bytes: 512 bytes of FP8_e4m3 quantized NoPE (with 4 float32 tile-level scale factors at 16 bytes), plus 128 bytes of unquantized BF16 RoPE — the RoPE part stays BF16 to preserve positional encoding accuracy. Compared to BF16's 2304 bytes/token, V32 enables ~122K-token context in 80 GB vs. ~35K for BF16 (3.5× savings).
- The MODEL1 FP8 format is more compact at 512 bytes/token (448 FP8_e4m3 + 8 bytes float8_e8m0fnu scale + 64 bytes BF16 RoPE), enabling ~156K-token context (4.5× savings over BF16).
- [[H800]] cannot directly cast FP8_e4m3 to BF16; dequantization requires four conversion steps: FP8 → half (native instruction), half → float32, float32 × scale, float32 → BF16. This multi-step pipeline is the dequantization bottleneck (~50 cycles/token vs. ~34 cycles for MMA).
- The DSM crossover technique uses [[Hopper]] Distributed Shared Memory to split dequantization between two CTAs in a cluster: each CTA loads and dequantizes half the KV, then `st.async` writes its half to the peer CTA's shared memory, synchronized via cluster transaction barrier. Result: dequantization per CTA drops from ~50 to ~25 cycles, removing the bottleneck and achieving 64% throughput improvement (250 TFlops → 410 TFlops).
- [[FlashMLA]] uses a paged KVCache layout with a block table mapping logical sequence positions to physical blocks (default 64 tokens/block), enabling dynamic allocation, memory sharing across sequences (beam search), and fragmentation-free variable-length handling. Sparse attention index encoding: `block_idx × page_block_size + offset_in_block`.
- TMA pipelining for a 64×576 K-block launches 9 TMA copies (each 64×64) and starts GEMM operations as each copy completes, overlapping load and compute to hide memory latency. `EVICT_FIRST` cache hint tells L2 to de-prioritize KV data accessed once per token generation.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[FlashMLA]], [[H800]], [[Hopper]], [[FP8]], [[TMA]], [[CUDA]]

## Topics touched

[[KV Cache Management]], [[GPU Memory Management]], [[Attention Kernels]], [[Quantization]]

## Raw source

[wiki.litenext.digital/wiki/flashmla?file=04-memory-management](https://wiki.litenext.digital/wiki/flashmla?file=04-memory-management) — DeepWiki-generated architecture doc, FlashMLA commit 48c6dc4, generated 2026-01-27. Read 2026-05-15.
