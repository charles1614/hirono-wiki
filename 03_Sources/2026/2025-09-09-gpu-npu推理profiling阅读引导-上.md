---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/xNKdTl5cUPnpVe3OQ3wXKg
tags: [inference, observability, gpu]
---

# [2025-09-08] GPU/NPU推理Profiling阅读引导(上）

## TL;DR

A practical walkthrough for reading GPU profiling traces from LLM inference, using vLLM with Qwen2.5 on NVIDIA GPU as the example. Covers data collection via PyTorch Profiler, importing into Perfetto, and interpreting Python-layer and GPU-stream timelines including GQA, FFN, and TP all-reduce operations.

## Key claims

- PyTorch Profiler with CUDA activities exports a Chrome trace JSON viewable in Perfetto (https://ui.perfetto.dev) or `chrome://tracing`; a single GQA+FFN layer takes ~700μs in the Python layer with 4-way tensor parallelism on Qwen2.5-7B.
- In the Python timeline, GQA (QKV linear + split + RoPE + paged attention + KV cache write) is separated from FFN (up/gate projection + silu + all-reduce + down projection) by RMSNorm; each op maps to distinct timeline segments.
- With TP enabled, O-projection uses column-split weights requiring an all-reduce; Up/Gate uses column-split and Down uses row-split, also requiring an all-reduce — both visible as NCCL ops in the stream timeline.
- FFN linear kernels invoke CUTLASS under the hood; silu kernel metadata shows input tensor dtype; these are identifiable directly in the stream-layer trace.
- Two scenarios are demoed: GPU + Qwen2.5 (Dense) + Chrome tracing (this part); NPU + DeepSeek-V3 (MoE) + Nsight/Insight (upcoming part 2).

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-09-gpu-npu推理profiling阅读引导-上/weixin-img-004.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-09-gpu-npu推理profiling阅读引导-上/weixin-img-006.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-09-gpu-npu推理profiling阅读引导-上/weixin-img-011.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-09-gpu-npu推理profiling阅读引导-上/weixin-img-012.png)

*Other images decorative (header/footer, additional timeline crops inline-described in body).*

## Entities touched

[[vLLM]], [[Nsight Systems]], [[CUTLASS]], [[GQA]], [[RoPE]]

## Topics touched

[[GPU Profiling]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/xNKdTl5cUPnpVe3OQ3wXKg](https://mp.weixin.qq.com/s/xNKdTl5cUPnpVe3OQ3wXKg) — WeChat article by InfraTech, published 2025-09-08. Read 2026-05-16.
