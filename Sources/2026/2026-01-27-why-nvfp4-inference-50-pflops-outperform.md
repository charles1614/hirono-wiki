---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/NVIDIA/TransformerEngine/issues/2565
tags: [inference, training, low-precision, gpu]
---

# [2026-01-06] Why NVFP4 Inference (50 PFLOPS) Outperforms Training (35 PFLOPS) on Rubin GPU — TransformerEngine Issue #2565

## TL;DR

A NVIDIA TransformerEngine team member explains why the Rubin GPU's NVFP4 inference throughput (50 PFLOPS) exceeds training throughput (35 PFLOPS) despite the same underlying GEMM performance: inference uses calibrated, tensor-wide static scaling factors, while training must compute scaling factors dynamically and applies additional operations like Random Hadamard Transformations in the backward pass that are absent during inference.

## Key claims

- NVFP4 inference uses predetermined tensor-wide scaling factors obtained via calibration, enabling aggressive kernel fusion; NVFP4 training must compute scaling factors dynamically at quantization time, limiting fusion opportunities. [[NVFP4]] [[Transformer Engine]] [[Rubin]]
- Training applies Random Hadamard Transformations in the backward pass only (not used in inference), further widening the throughput gap; GEMM performance is the same for both workloads — the end-to-end difference stems from recipe differences, not hardware asymmetry. [[NVFP4]]
- The NVIDIA hardware "adaptive compression" feature described in the 3rd Gen Transformer Engine blog is not publicly detailed beyond the official disclosure; NVIDIA member confirmed they cannot comment on unreleased hardware specifics. [[Transformer Engine]] [[Rubin]]
- The throughput gap is better described as "achievable FLOPS in training vs. inference" rather than a hardware asymmetry, since the underlying GEMM units deliver identical peak performance in both directions. [[NVFP4]]

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[NVFP4]], [[Transformer Engine]], [[Rubin]]

## Topics touched

[[Low-Precision Training]], [[GPU Microarchitecture]]

## Raw source

[github.com/NVIDIA/TransformerEngine/issues/2565](https://github.com/NVIDIA/TransformerEngine/issues/2565) — GitHub issue, open, 3 speakers (OP + NVIDIA Member + follow-up), Jan 2026. Read 2026-05-15.
