---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/flashmla?file=03-kernel-implementations
tags: [inference, attention-kernels, gpu, tooling, long-context]
---

# [2026-01-30] FlashMLA Kernel Implementations (DeepWiki doc 03)

## TL;DR

DeepWiki-generated reference for FlashMLA's four CUDA kernel types: dense decode (SM90/Hopper, seesaw schedule), sparse decode with FP8 KVCache (SM90 crossover + SM100 Blackwell), dense prefill (SM100/Blackwell, CUTLASS-based with backward support), and sparse prefill (SM90/SM100). Documents performance targets, code organization, and scheduling architecture.

## Key claims

- [[FlashMLA]] implements four primary kernel types: dense decode (SM90, [[Hopper]]), sparse decode FP8 (SM90 + SM100), dense prefill (SM100, [[Blackwell]]), sparse prefill (SM90/SM100). Each targets distinct inference phases and GPU architectures.
- Dense decode (SM90) reaches 660 TFlops compute-bound and 3000 GB/s memory-bandwidth on [[H800]] SXM5. Uses seesaw scheduling: 64×512 output matrix consumes 32,768 registers (half SM capacity), so output is split into O_L/O_R and two warpgroups alternate over K blocks with cross-update; ~80% Tensor Core utilization.
- Sparse decode FP8 (SM90) reaches 410 TFlops (b=128, topk=2048) and 460 TFlops at large topk=32,768. The crossover technique (2-CTA cluster + DSM) halves dequantization per CTA from ~50 to ~25 cycles, shifting the bottleneck from dequantization to MMA — desired for compute-bound operation. Supports V32 (656 bytes/token) and MODEL1 (512 bytes/token) [[FP8]] formats.
- Dense prefill (SM100 / [[Blackwell]]) leverages [[CUTLASS]] template integration and achieves 1,460 TFlops forward and 1,000 TFlops backward on B200. Includes full backward pass for training; workspace bytes for backward scales with `4 × bs × max_seqlen_qo_aligned × num_qo_heads × head_dim_qk`.
- The tile scheduler metadata (`DecodingSchedMeta`) distributes work across SMs by assigning request and block ranges; `num_splits_ptr` records how many SMs process each batch item. FlashMLA uses CUDA programmatic dependent launch to overlap the main splitkv kernel with the combine kernel, eliminating host-device sync overhead.
- The combine kernel aggregates split-KV partial results using log-sum-exp: `final_lse = logsumexp(partial_lse_i)`, `final_out = Σ partial_out_i × exp(partial_lse_i − final_lse)`. Optional `attn_sink` parameter scales final output for attention sink support.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[FlashMLA]], [[H800]], [[Hopper]], [[Blackwell]], [[CUTLASS]], [[FP8]], [[CUDA]]

## Topics touched

[[Attention Kernels]], [[GPU Kernel Scheduling]], [[Tensor Core Programming]], [[Kernel Authoring]]

## Raw source

[wiki.litenext.digital/wiki/flashmla?file=03-kernel-implementations](https://wiki.litenext.digital/wiki/flashmla?file=03-kernel-implementations) — DeepWiki-generated architecture doc, FlashMLA commit 48c6dc4, generated 2026-01-27. Read 2026-05-15.
