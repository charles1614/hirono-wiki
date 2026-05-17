---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/F0goD1U6DZ7SQw2ElPTp5A
tags: [inference, attention-kernels, kv-cache, minimal-impl]
---

# [2025-06-16] 细数DeepSeek MLA layer从naive实现开始的5大优化策略

## TL;DR

Step-by-step walkthrough building a DeepSeek [[MLA]] (Multi-head Latent Attention) decode layer from a naive PyTorch implementation, then applying five progressive optimizations: matrix absorption, high-performance attention kernels, fast GEMM operators, precomputed RoPE caches, and CUDA graph/`torch.compile` to reduce host overhead. Each optimization is explained with code and expected speedups.

## Key claims

- Naive MLA config uses `dim=7168`, `n_heads=128`, `q_lora_rank=1536`, `kv_lora_rank=512`, `qk_nope_head_dim=128`, `qk_rope_head_dim=64`, `v_head_dim=128`; decode KV cache stores only the compressed latent `c_kv` (shape `[batch, seq, kv_lora_rank + qk_rope_head_dim]`).
- **Optimization 1 (matrix absorption)**: instead of concatenating RoPE and non-RoPE components into a full key/value, compute their attention contributions separately and sum; absorb `W_UK` into `q_nope * W_UQ`, reducing KV head count from 128 (MHA) to 1 (MQA) and saving significant VRAM.
- **Optimization 2**: use [[FlashMLA]] on NVIDIA GPUs; AMD has a comparable MLA kernel.
- **Optimization 3**: DeepSeek-V3 uses FP8 block-wise quantization for all linear layers; PyTorch 2.6's `torch._scaled_mm` supports only FP8 tensor-wise and row-wise GEMM, not block-wise — requiring CUTLASS FP8 block-wise GEMM directly.
- **Optimization 4**: precompute RoPE `cos`/`sin` for the full `max_position_embeddings` outside the forward pass; the result is a static cache, avoiding recomputation on every decode step.
- **Optimization 5**: apply `torch.compile` or CUDA Graph during decode; batch size is the only variable dimension, so capture is straightforward and eliminates kernel-launch and operator-dispatch overhead.
- Combined effect: 几十倍 to 100× speedup over naive implementation depending on shape.

## Visual observations

*No load-bearing images — figures inline-captioned in raw, no standalone images.*

## Entities touched

[[MLA]], [[DeepSeek]], [[FlashMLA]], [[FP8]], [[CUDA Graph]]

## Topics touched

[[Attention Kernels]], [[KV Cache Management]], [[Low-Precision Training]]

## Raw source

[mp.weixin.qq.com/s/F0goD1U6DZ7SQw2ElPTp5A](https://mp.weixin.qq.com/s/F0goD1U6DZ7SQw2ElPTp5A) — WeChat public account "AI不止算法", published 2025-06-16. Read 2026-05-16.
