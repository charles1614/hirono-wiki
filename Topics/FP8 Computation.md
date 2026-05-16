---
created: 2026-05-12
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 7
---

# FP8 Computation

## What

8-bit floating-point arithmetic for training / inference acceleration on Tensor Cores supporting FP8 (Hopper / Blackwell).

## Current understanding

FP8 is an 8-bit floating-point format designed to accelerate deep-learning workloads on hardware Tensor Cores that natively support it. NVIDIA introduced FP8 Tensor Core support with **Hopper** (H100), and Google added native FP8 to **Ironwood** (TPU v7) — prior Google TPU generations (v4, v5p) only emulated FP8 [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. Two encodings are in common use: **E4M3** (4 exponent bits, 3 mantissa bits), preferred for activations and weights, prioritizing precision; and **E5M2** (5 exponent bits, 2 mantissa bits), preferred for gradients, prioritizing dynamic range. They serve complementary roles within a single forward/backward pass.

The central tension in FP8 computation is **scale management**. Because 8-bit formats have a drastically smaller dynamic range than BF16 or FP32, naive casting causes saturation or underflow on the tails of activation and weight distributions. Practical implementations maintain per-tensor (or per-tile) **scale factors** — stored in higher precision — that shift the distribution into the representable range before the GEMM and restore it after. The granularity and update frequency of scale factors are implementation-defined and have a large effect on numerical stability. **Delayed scaling** (computing scale statistics over recent history rather than the current micro-batch) is the dominant practical approach, avoiding the overhead of exact dynamic scaling without sacrificing stability.

During **inference**, FP8 roughly doubles Tensor Core FLOPS versus BF16 in theory; H100 peaks at ~3.9 PFLOPS (FP8) vs ~1.98 PFLOPS (BF16). However, real-world speedups fall short of 2×: NVIDIA's Transformer Engine (TE) leaves **Softmax and GeLU unquantized**, and **DotProductAttention uses FlashAttention rather than FP8 Tensor Cores**, so data-format-conversion overhead consumes a meaningful fraction of the nominal gain [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]. Only `te.Linear` is a fully FP8-quantized operator path in the current TE library. A practitioner targeting H100 must manually replace `nn.Linear` + `RMSNorm` with TE equivalents — TE does not automatically accelerate decode-only causal LMs.

During **training**, FP8 is used for the forward and backward GEMMs while gradient accumulation and optimizer states remain in higher precision (BF16 or FP32). The frontier is pushing to even lower precision: NVIDIA's **NVFP4** (4-bit FP, Blackwell-specific) paper reports a 12B model trained on 10T tokens matching FP8 training loss and downstream accuracy [[2026-02-04-pretraining-large-language-models-with-n]]. The four ingredients that make FP4 stable — Random Hadamard transforms (RHT) to bound block-level outliers, a 2-D quantization scheme for consistent forward/backward representations, stochastic rounding for unbiased gradients, and selective high-precision layers for numerically sensitive operators — establish the reference template for sub-FP8 pretraining on Blackwell hardware.

In **production inference systems**, FP8 has become the default precision for MoE decoding kernels. Ant Group's SGLang deployment of DeepSeek on H20-96G uses FP8 FlashMLA for decode-side attention [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]], and the H20 platform's lopsided compute/bandwidth profile (~15% of H800's FP8/BF16 throughput, but larger VRAM and faster NVLink) illustrates how hardware-specific compute density shapes deployment topology: FP8's arithmetic density advantage matters less when the system is bandwidth-bound rather than compute-bound.

The generational trajectory is clear: each hardware generation adds lower-precision native support (INT8 → FP8 → FP4), and the software infrastructure (Transformer Engine, Megatron-LM, DeepGEMM) races to close the gap between theoretical peak and realized throughput. The load-bearing practitioner primitives remain: (1) E4M3 / E5M2 format selection per tensor role; (2) scale factor computation, storage, and propagation; (3) delayed vs. dynamic scaling trade-offs; (4) which operators in the active framework actually run on FP8 Tensor Cores vs. fall back silently; and (5) the interaction between the quantization scheme and the training stability of long runs.

## Comparison

| Axis | H100 FP8 (Hopper, NVIDIA) | H20 FP8 (Hopper-derivative, NVIDIA) | Ironwood FP8 (TPU v7, Google) |
|---|---|---|---|
| **Peak FP8 FLOPS / chip** | ~3,958 TFLOPS (3.9 PFLOPS) [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] | ~15% of H800 FP8/BF16 throughput (exact TFLOPS ?) [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] | **4,614 TFLOPS** [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] |
| **FP8 native vs emulated** | Native (first-generation FP8 TC on Hopper) [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] | Native (same Hopper silicon) | **Native** (v4/v5p only emulated FP8) [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] |
| **HBM per chip** | 80 GB (SXM5) | 96 GB [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] | **192 GB** (6× Trillium) [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] |
| **FP8 vs BF16 throughput ratio (peak)** | ~2× (3.9 vs 1.98 PFLOPS); realized less due to TE coverage gaps [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] | ? | ? |
| **Software FP8 library** | Transformer Engine: `te.Linear` fully FP8; Softmax, GeLU, DotProductAttention not quantized to FP8 [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] | Same TE stack + DeepGEMM + FP8 FlashMLA for MoE decode [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] | XLA / JAX (FP8 quantization integration details ?) |
| **FP8 training stability mechanism** | Delayed scaling via TE; FP32 accumulation within TC warp [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] | N/A (H20 is inference-optimized) | ? |
| **Next-precision target** | NVFP4 on Blackwell: 12B / 10T tokens matches FP8 baseline [[2026-02-04-pretraining-large-language-models-with-n]] | N/A | INT4 inference (v5e supports INT8/INT4; Ironwood inference-first trajectory) [[2026-01-09-google-tpus-explained-architecture-perfo]] |
| **Key deployment pattern** | Large-batch training + prefill; standard LLM serving via TE | Inference disaggregation (TP8 prefill + DP16/EP16 decode) driven by lopsided bandwidth/compute ratio [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] | Context-heavy inference at pod scale (Gemini 3 production) [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] |

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

## Observations

- Qwen3.5's training infrastructure applies FP8 end-to-end (activations, MoE routing, GEMM) with runtime monitoring to keep sensitive layers in BF16, achieving ~50% activation memory reduction and >10% speedup; the same FP8 pipeline is used in its asynchronous RL rollout framework, yielding 3×–5× end-to-end RL training speedup at tens of trillions of token scale. — [[2026-03-04-qwen3-5-blog]]
