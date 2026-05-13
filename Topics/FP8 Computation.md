---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 2
---

# FP8 Computation

## What

8-bit floating-point arithmetic for training / inference acceleration on Tensor Cores supporting FP8 (Hopper / Blackwell).

## Current understanding

FP8 is an 8-bit floating-point format designed to accelerate deep-learning workloads on hardware Tensor Cores that natively support it — most prominently NVIDIA's Hopper (H100) and Blackwell (B100/B200) architectures. Two encodings are in common use: **E4M3** (4 exponent bits, 3 mantissa bits), which prioritizes precision and is preferred for activations and weights; and **E5M2** (5 exponent bits, 2 mantissa bits), which prioritizes dynamic range and is preferred for gradients during training. The two formats serve complementary roles within a single forward/backward pass.

The central tension in FP8 computation is **scale management**. Because 8-bit formats have a drastically smaller dynamic range than BF16 or FP32, naive casting causes saturation or underflow on the tails of the activation and weight distributions. Practical implementations therefore maintain per-tensor (or per-tile) **scale factors** — typically stored in higher precision — that shift the distribution into the representable range before the GEMM and restore it after. This is analogous to block floating point, but the granularity and update frequency of the scale factors are implementation-defined and have a large effect on numerical stability.

During **inference**, FP8 is used as a quantization target for both weights and KV-cache activations. The main gain is throughput: Hopper H100 offers roughly twice the Tensor Core FLOPS in FP8 versus BF16 (e.g., 3.9 PFLOPS vs 1.98 PFLOPS peak for dense GEMMs). Memory bandwidth savings from 2× smaller weights also reduce the memory-bound bottleneck that dominates autoregressive decoding. Static per-tensor calibration (offline scale computation over a representative dataset) is the dominant approach for inference; dynamic per-token or per-channel scaling is used when accuracy loss from static calibration is unacceptable.

During **training**, FP8 is used for the forward and backward matrix multiplications (GEMM), while gradient accumulation and optimizer state updates remain in higher precision (BF16 or FP32). The critical concern is that gradient distributions are more heavy-tailed than weight/activation distributions, making E5M2 the preferred format for dW and dX passes. Delayed scaling (computing scale statistics over recent history rather than the current micro-batch) is the most common practical approach to avoid the overhead of exact dynamic scaling without sacrificing stability. Training in FP8 is newer and less standardized than inference; frameworks like Transformer Engine (NVIDIA) provide the infrastructure for the precision casting and scale bookkeeping.

The **load-bearing primitives** that a practitioner needs to understand are: (1) the E4M3 / E5M2 format selection per-tensor role; (2) scale factor computation, storage, and propagation; (3) delayed scaling vs. dynamic scaling trade-offs; (4) the accumulation precision used inside the GEMM (H100 accumulates FP8 dot products in FP32 within each Tensor Core warp, so internal overflow is not the dominant failure mode — scale management at the tile boundary is); and (5) the interaction with quantization-aware training (QAT) vs. post-training quantization (PTQ) workflows.

No Sources have been ingested into this wiki on this topic yet; the above reflects general technical consensus as of early 2026. Populate with wikilinks as sources are added.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
