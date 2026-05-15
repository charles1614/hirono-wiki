---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/peA089QQthXQbZiXAJOkKg
tags: [training, inference, tpu, gpu, accelerator-design]
---

# [2026-01-15] TPU vs GPU 全面技术对比：谁拥有 AI 算力最优解？

## TL;DR

A systematic TCO and architectural analysis (海外独角兽, author NCL) re-examining SemiAnalysis's TPU v7/v8 deep-dive. Key finding: TPU wins on training and latency-insensitive inference TCO, but GB200/GB300 reverses that advantage in Prefill (35–50% lower cost via FP4) and the 3D Torus–NVSwitch divide is fundamentally about traffic-pattern assumptions, not raw bandwidth.

## Key claims

- **Training TCO**: SemiAnalysis estimates TPUv7 delivers 45–56% training cost advantage over NVIDIA H100/Blackwell (Anthropic saves 45%, Google internal 56%), assuming [[TPU]] FP8 MFU of 40% vs [[GPU]] 30% — but the MFU gap is contested since BF16 public data shows ByteDance MegaScale brought H100 close to TPU levels.
- **Prefill (推理)**: GB200/GB300 reverses the cost advantage with FP4 — 35–50% lower Prefill cost than TPUv7 External; SGLang achieves 3.8x H100 Prefill throughput on GB200 NVL72 by exploiting NVFP4; single-card TCO ~$0.047/M tokens vs H100's ~$0.14/M tokens.
- **Decode**: Bottleneck shifts from HBM bandwidth (small batch) to NVLink bandwidth (large batch, via MoE all-to-all); TPUv7's HBM bandwidth per-TCO advantage is partially eroded by Scale-up interconnect sensitivity, making real-world gap smaller than HBM specs suggest.
- **3D Torus vs Switch Fabric**: TPU's 3D Torus + OCS assumes predictable/schedulable communication flows (gradient sync, TP/PP collectives) and can saturate links at 1k–20k chip scale for regular LLM training; NVSwitch assumes arbitrary traffic and wins on <100-chip scale, MoE training (irregular all-to-all), and latency-sensitive inference. Fabric choice is a traffic-pattern assumption, not a speed contest.
- **TPU cluster scaling math**: v7p Pod = 4×4×4 = 64 TPUs; each Pod needs 96 OCS ports; 48 × 288-port OCS = 13,824 total ports → max 144 Pods × 64 = 9,216 TPUs. Upgrading OCS to 300×300 (576 usable ports) doubles the ceiling to 18,432 TPUs with same Pod topology.
- **TPU v8 competitive erosion**: v8 chose 3nm + HBM3E; NVIDIA Rubin targets HBM4 (20 TB/s vs TPU v8's 9.8 TB/s), FP4 double compute, and a low-cost Prefill-optimized CPX chip. Training TCO gap narrows from GB200/TPUv7 1.52× to VR200/TPUv8p 1.23×; HBM bandwidth per-TCO gap narrows from 1.32× to 1.10×.
- **[[Anthropic]]** cited as needing to rebuild NVIDIA partnership because TPU v8's eroding advantage makes it impractical to ignore NVIDIA's iteration pace.

## Visual observations

*![](../../raw/raindrop/mp.weixin.qq.com/2026-01-15-tpu-vs-gpu-全面技术对比-谁拥有-ai-算力最优解/weixin-img-005.png)*
*![](../../raw/raindrop/mp.weixin.qq.com/2026-01-15-tpu-vs-gpu-全面技术对比-谁拥有-ai-算力最优解/weixin-img-011.png)*
*![](../../raw/raindrop/mp.weixin.qq.com/2026-01-15-tpu-vs-gpu-全面技术对比-谁拥有-ai-算力最优解/weixin-img-012.png)*
*Other images decorative — article banner, source attribution screenshots, illustrative diagrams.*

## What this changes

- Provides a quantitative framework for comparing [[TPU]] vs [[GPU]] across training/Prefill/Decode with specific OCS cluster-size math and TCO ratios for the Blackwell vs TPUv7/v8 generation.

## Entities touched

[[TPU]], [[GPU]], [[Anthropic]], [[Google]], [[GB200]], [[Blackwell]]

## Topics touched

[[Accelerator Economics]], [[AI Accelerators]], [[Training Infrastructure]], [[Inference Disaggregation]]

## Raw source

[mp.weixin.qq.com/s/peA089QQthXQbZiXAJOkKg](https://mp.weixin.qq.com/s/peA089QQthXQbZiXAJOkKg) — WeChat public account 海外独角兽, author NCL, editors Feihong/Siqi, 2026-01-15. Read 2026-05-15.
