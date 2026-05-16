---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/-dB3RCyq-PFQHuZwN7AK0w
tags: [inference, quantization, low-precision, moe, benchmark]
---

# [2025-05-21] 基于vLLM v1测试BFloat16 vs FP8 Qwen3-MoE模型吞吐性能的重大发现

## TL;DR

Empirical throughput comparison of [[Qwen3-235B]] BF16 (TP8) vs FP8 (TP4) variants on [[vLLM]] v0.8.5.post1, measuring both online-serving and offline-batch scenarios. FP8 yields 1.5–1.75× per-device throughput gain, falling short of the theoretical 2× ceiling due to dynamic activation quantization and block-wise weight quantization overhead.

## Key claims

- FP8 model uses e4m3 format with dynamic activation quantization and static weight quantization at [128, 128] block granularity — matching DeepSeek-series quantization scheme.
- FP8+TP4 fails at `--tensor-parallel-size 8` because MoE intermediate size 768 per card (1536/TP8) is not divisible by the 128-element quantization block; TP4 gives 384 per card (divisible).
- Online-serving (ShareGPT): FP8+TP4 output token throughput per device = 901.2 tok/s vs BF16+TP8 = 515.2 tok/s — ~1.75× improvement; request throughput per device 4.25 vs 2.56 req/s (~1.66×).
- Offline batch (BS=128, input=1024, output=128): FP8+TP4 = 340.7 tok/s per device vs BF16+TP8 = 226.1 tok/s per device — ~1.50× improvement.
- Both online and offline results are below 2× despite FP8 halving model size, attributable to the compute overhead of on-the-fly activation scale computation and the block-wise quantization overhead on weights.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

Provides concrete per-device throughput numbers for BF16-vs-FP8 comparison on a large MoE model, with a documented TP-config pitfall specific to Qwen3-MoE's intermediate dimension and block quantization granularity.

## Entities touched

[[vLLM]], [[Qwen]], [[Qwen3-235B]], [[FP8]], [[BF16]]

## Topics touched

[[Attention Kernels]]

## Raw source

[mp.weixin.qq.com/s/-dB3RCyq-PFQHuZwN7AK0w](https://mp.weixin.qq.com/s/-dB3RCyq-PFQHuZwN7AK0w) — WeChat public account "AI不止算法", published 2025-05-21. Read 2026-05-16.
