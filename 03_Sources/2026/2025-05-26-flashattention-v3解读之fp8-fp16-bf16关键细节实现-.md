---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/9sDJlHQRzSiuTc_EmwjxzA
tags: [attention-kernels, gpu-programming, source-shape/blog, low-precision]
---

# [2025-04-23] FlashAttention-V3解读之FP8/FP16/BF16关键细节实现 (下篇)

## TL;DR

A detailed implementation walkthrough of [[FlashAttention-3]]'s FP8 vs FP16/BF16 differences on Hopper GPUs, covering block quantization, the incompatible wgmma output/input layouts that require a LDSM_T → STSM_N transpose, and the two overlapping techniques (inter-WG and intra-WG) shared across all precision modes.

## Key claims

- FA3 introduces FP8 QKV using block quantization: each matrix is split into 128×128 blocks each with its own scale, and `gemm0_output × ws0 × as0` produces the per-block-scaled result. [[DeepSeek-V3]] uses the same weight block quantization (128×128) but 1×128 activation quantization.
- FP8 wgmma layout incompatibility: the fp32 accumulator (C/S matrix) after gemm0 has non-contiguous thread ownership (T0 owns d0, d1, d4, d5 — not sequential), while fp8 operand A for gemm1 requires contiguous elements (T0 owns a0–a3). Direct reuse after softmax is broken.
- Fix: CUTLASS 3.5+ `permutationLayout` in `make_tiled_mma` reorders accumulator elements to match operand-A layout. FP16/BF16 wgmma accumulator and operand A ARE compatible — no permutation needed.
- V transpose is required for both precision modes (gemm1 reduce dimension is seqlen, but V is head-dim contiguous): Hopper solution uses LDSM_T source layout → STSM_N destination layout to transpose V in shared memory without going through registers (prehopper could use LDSM_T register transpose).
- Blackwell GPUs (`tcgen05.mma`) natively support block scaling as a hardware instruction — no manual multiplication of ws0/as0 required.
- Shared techniques (FP8 and FP16/BF16): inter-WG overlap (barrier-based pingpong between two consumer WGs, keeping TensorCores busy across K iterations), intra-WG overlap (gemm1 at iter X overlaps with softmax at iter X+1 via wgmma async, at cost of register pressure).

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-05-26-flashattention-v3解读之fp8-fp16-bf16关键细节实现-/weixin-img-001.png)
![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-05-26-flashattention-v3解读之fp8-fp16-bf16关键细节实现-/weixin-img-007.png)

## Entities touched

[[FlashAttention-3]], [[DeepSeek-V3]], [[NVSHMEM]]

## Topics touched

[[Attention Kernels]], [[Tensor Core Programming]], [[Low-Precision Training]], [[FP8 Computation]], [[Communication-Computation Overlap]]

## Raw source

[mp.weixin.qq.com/s/9sDJlHQRzSiuTc_EmwjxzA](https://mp.weixin.qq.com/s/9sDJlHQRzSiuTc_EmwjxzA) — WeChat public account "AI不止算法", published 2025-04-23. Read 2026-05-16.
