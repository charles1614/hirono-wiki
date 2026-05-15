---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/flashmla?file=01-overview
tags: [inference, attention-kernels, gpu, tooling]
---

# [2026-01-27] FlashMLA Overview — DeepSeek's MLA CUDA Kernel Library

## TL;DR

FlashMLA is DeepSeek's production-grade CUDA kernel library for Multi-head Latent Attention (MLA), powering inference in DeepSeek-V3, V3.1, and V3.2. It provides four kernel types (dense/sparse decode, dense/sparse prefill) targeting Hopper and Blackwell GPUs, combining seesaw scheduling, FP8 KVCache quantization, and token-level sparse attention to achieve up to 660 TFlops on H800 and 1460 TFlops on B200.

## Key claims

- FlashMLA operates in MQA mode with 128 query heads sharing 1 KV head; the compute-memory ratio (~256 flops/byte) makes MLA decoding compute-bound on H800, justifying seesaw scheduling over memory-bound optimizations. [[DeepSeek-V3]]
- Four kernel types: Dense Decode (660 TFlops H800, BF16), Sparse Decode FP8 (410 TFlops, uses crossover via Distributed Shared Memory), Dense Prefill (1460 TFlops B200, CUTLASS-based, backward pass supported), Sparse Prefill (1450 TFlops B200). [[FlashMLA]]
- The V32 FP8 KVCache format stores each token in 656 bytes (vs. 2304 bytes BF16), a 4× reduction: 512 FP8_e4m3 NoPE values + 4 float32 tile-scale factors + 64 BF16 RoPE values (RoPE kept in higher precision due to quantization sensitivity). [[FlashMLA]] [[FP8]]
- Seesaw scheduling addresses register pressure from the 64×512 output matrix (32K values ≈ all SM registers): two warpgroups interleave CUDA Core and Tensor Core operations, unlike conventional ping-pong scheduling. [[FlashMLA]] [[Hopper]]
- DeepSeek Sparse Attention (DSA) uses token-level sparsity (top-k most relevant tokens per query); FP8 sparse decode uses Distributed Shared Memory crossover so two CTAs share dequantized KV values, halving dequantization overhead. [[MLA]] [[Distributed Shared Memory]]
- Dense decode achieves 3000 GB/s on H800 (89% of 3.35 TB/s peak) in memory-bound configurations; Hopper support requires CUDA 12.8+, Blackwell (SM100) requires CUDA 12.9+. [[H800]] [[Blackwell]]
- Python API (`flash_mla_with_kvcache`) takes paged KVCache with block table, `head_dim_v=512` (always for DeepSeek), and `FlashMLASchedMeta` from `get_mla_metadata()`; fine-grained TMA pipelining overlaps memory transfers with compute. [[CUDA]] [[TMA]]

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[FlashMLA]], [[MLA]], [[DeepSeek-V3]], [[FP8]], [[Hopper]], [[Blackwell]], [[CUTLASS]], [[Distributed Shared Memory]], [[TMA]], [[H800]], [[CUDA]]

## Topics touched

[[Attention Kernels]], [[GPU Kernel Scheduling]], [[KV Cache Management]], [[Low-Precision Training]]

## Raw source

[wiki.litenext.digital/wiki/flashmla](https://wiki.litenext.digital/wiki/flashmla?file=01-overview) — DeepWiki auto-generated architecture doc, source commit `48c6dc4`, 2026-01-27. Read 2026-05-15.
