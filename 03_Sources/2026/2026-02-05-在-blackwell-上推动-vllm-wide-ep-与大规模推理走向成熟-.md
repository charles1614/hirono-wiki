---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/HL9YuabPLSPj4vPTmRBVfw
tags: [inference, gpu, moe, parallelism, low-precision, production-deployment]
---

# [2026-02-05] 在 Blackwell 上推动 vLLM Wide-EP 与大规模推理走向成熟（Part I）

## TL;DR

vLLM team details the key optimizations that achieved 26.2K prefill TPGS and 10.1K decode TPGS on NVIDIA GB200 for DeepSeek R1/V3/V3.1 — a 3–5× improvement over H200 deployments. The gains come from four orthogonal levers: low-precision ops (NVFP4/FP8), kernel fusion, weight offloading v2 with async prefetch, and chunking overhead minimization.

## Key claims

- [[vLLM]] reached 26.2K prefill tokens/GPU/second and 10.1K decode TPGS on [[GB200]] for DeepSeek MoE workloads at 2K input + 2K output tokens, using 4 prefill instances (2 GPUs each) and 1 decode instance (8 GPUs). — headline numbers for the GB200 Wide-EP deployment
- [[NVFP4]] GEMM for MoE expert weights + O-proj uses FlashInfer's TRTLLM-Gen kernels optimized for GB200's FP4 tensor cores; weights are stored in packed 4-bit format with per-group scaling factors, dequantized on-the-fly inside the tensor core. — NVFP4 implementation detail
- NVFP4 MoE dispatch quantizes token activations to FP4 before all-to-all communication, reducing inter-GPU communication volume by 4× versus FP16 dispatch. — key EP communication reduction
- Three kernel fusions reduce memory bandwidth pressure: RoPE+Quant+Q Write (decode), RoPE+Quant (prefill), and FlashInfer `concat_mla_k` for [[MLA]] key tensor construction. — fused kernels eliminate intermediate memory round-trips
- Weight offloading v2 uses asynchronous prefetch on a separate CUDA stream to overlap weight onload with kernel execution; GB200's [[NVLink]]-C2C CPU-GPU interconnect minimizes load latency vs. PCIe. — allows smaller per-GPU memory footprint without throughput loss
- Prefill scale-down from 4 GPUs to 2 GPUs per instance improves throughput because MLA/MoE compute is already saturated at 64K tokens; reducing EP degree halves NCCL all_gather+reduce_scatter overhead. — counterintuitive: fewer GPUs → higher prefill TPGS when compute-bound
- Chunking knobs (MoE DP chunk, activation chunk, output processing chunk) are all disabled or maximized on GB200 because larger memory capacity accommodates full batches without chunking. — deployment-specific tuning table

## Visual observations

*9 benchmark charts (throughput vs. batch size, latency curves, weight-offload config diagrams). No load-bearing numbers beyond what is quoted above — charts are supporting visuals for the trends described in the text.*

## What this changes

Establishes concrete GB200 Wide-EP deployment recipe for DeepSeek-class MoE models. The weight offloading v2 pattern (async prefetch via NVLink-C2C) and NVFP4 dispatch (4× communication reduction) are reusable across any large EP deployment on Blackwell hardware.

## Entities touched

[[vLLM]], [[Blackwell]], [[GB200]], [[NVFP4]], [[FP8]], [[MLA]], [[FlashInfer]], [[NVLink]], [[DeepSeek]], [[Expert Parallelism]], [[NCCL]]

## Topics touched

[[LLM Inference Systems]], [[MoE Serving]], [[Expert Parallelism]], [[Low-Precision Training]], [[Parallelism Strategies]]

## Raw source

[mp.weixin.qq.com/2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-](https://mp.weixin.qq.com/s/HL9YuabPLSPj4vPTmRBVfw) — WeChat/vLLM official blog repost, original at blog.vllm.ai/2026/02/03/dsr1-gb200-part1.html. Read 2026-05-15.
