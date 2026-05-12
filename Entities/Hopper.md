---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 5
tier: active
---

# Hopper

NVIDIA's 2022 GPU architecture; H100/H200/H800/GH200; introduced WGMMA, TMA, FP8.

## Synthesis

NVIDIA's 2022 architecture (H100/H200/H800/GH200) — introduced **WGMMA**, **TMA** (Tensor Memory Accelerator for block-level async copy), **DSM** (Distributed Shared Memory for SM-to-SM communication), **DPX** (dynamic-programming instructions), and **native FP8 Tensor Cores**. The HKUST microbenchmark study (arXiv:2402.13499) provides the canonical instruction-level data sheet for kernel authors. Transformer Engine's FP8 path on Hopper has practical limits (Softmax/GeLU not quantized; attention bypasses FP8 TC for FlashAttention). Hopper's SM register budget (65,536 32-bit registers) constrains kernel scheduling: FlashMLA's seesaw schedule is forced by the 32,768-register output-matrix footprint preventing FA-3-style ping-pong dual-buffering. Bookended on the deployment side by **H200's gpt-oss-120b quirk** (TensorRT-LLM's TRTLLM MoE backend doesn't support Hopper — H200 must use the `TRITON` backend from OpenAI).

## Observations

- gpt-oss-120b deployment on H200 has a peculiar constraint: TensorRT-LLM's `TRTLLM` MoE backend is not supported on Hopper, so H200 must use `moe_config.backend: TRITON` (OpenAI's Triton kernels, shipped in the NGC container). CUTLASS support on Hopper is "still ongoing". — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- CUDA 13.1's static-SM-partitioning mode for MPS uses **8-SM chunks** as the partition unit on Hopper+ discrete GPUs. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- HKUST + HIT instruction-level study (arXiv:2402.13499, Feb 2024) — the canonical Hopper microbenchmark reference. Three Hopper-novel features benchmarked for the first time: **TMA** (block-level async copy), **DSM** (SM-to-SM atomics), **DPX** (dynamic-programming HW). FP8 Tensor Cores are the qualitative LLM-acceleration jump. Practical TE limits exposed: Softmax/GeLU not FP8-quantized, DotProductAttention bypasses FP8 TC for FlashAttention. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- FlashMLA's **seesaw kernel scheduling** is a direct consequence of the Hopper SM register budget: each 64×512 output matrix occupies 32,768 32-bit registers (half the 65,536-register file), so only one output per SM is possible — preventing FlashAttention-3's two-output ping-pong design. Solution: vertically split output into O_L/O_R and rotate between two warpgroups on alternating KV blocks. Achieves ~80% Tensor Core utilization, 3 TB/s bandwidth on H800 SXM5. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
