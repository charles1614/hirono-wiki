---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/NjDjQDy9t7EP0rH53GnRAA
tags: [inference, gpu, moe, low-precision, benchmark, production-deployment]
---

# [2026-02-04] GPT-OSS 在 NVIDIA Blackwell 上的性能优化：推动 Pareto 前沿

## TL;DR

vLLM and NVIDIA jointly optimized `gpt-oss-120b` (OpenAI's native MXFP4 MoE model) on Blackwell (B200/GB200), achieving 38% higher maximum throughput and 13% lower minimum latency versus the InferenceMAX baseline. The work emphasizes optimizing the full Pareto frontier (TPS/GPU vs. TPS/user) rather than any single metric, through FlashInfer deep integration, torch.compile kernel fusion, and async scheduling.

## Key claims

- The optimization target is the **Pareto frontier** — the curve of TPS/GPU (TCO proxy) vs. TPS/user (interactivity) — not a single throughput or latency point; SemiAnalysis InferenceMAX benchmarks this bi-dimensional tradeoff. — framing distinguishes from single-metric benchmarks
- [[FlashInfer]] is used as the primary kernel backend for attention, MoE, and compute-intensive ops; specifically integrates `trtllm-gen` and `cutlass` backends for MoE, plus FP8 attention kernels, enabling JIT compilation and auto-tuning. — FlashInfer as foundational kernel library
- [[vLLM]] uses `torch.compile` infrastructure (not hand-coded fusion) to automatically fuse AllReduce+RMSNorm and Pad+Quant+Finalize+Slice operations; the Pad+Quant fusion (PR30647) is projected to deliver 6% additional speedup. — systematic fusion via compiler rather than manual kernel writing
- Async scheduling decouples CPU request preparation from GPU execution, hiding host overhead; on Blackwell-class GPUs (H200, B200, GB200), yields ~10% throughput improvement. — enabled by default in latest vLLM
- Stream Interval buffers generated tokens before sending to clients, reducing HTTP/gRPC response frequency; in high-concurrency benchmarks (`gpt-oss-20b` at 1024 concurrent), yields 57% end-to-end improvement and better TPOT. — configurable via `--stream-interval <N>`, default 1
- On [[Blackwell]], the host CPU often becomes the bottleneck because the GPU executes so fast; async scheduling + stream interval together address this "host overhead" gap between kernel launches. — architectural insight specific to Blackwell generation
- Future roadmap: prefill/decode disaggregation for higher per-GPU throughput; DEP2 (Attention DP + MoE EP on 2 GPUs) underperforming TP1/TP2 due to MoE kernel selection issues; dedicated micro-gemm kernels for TP8. — active engineering directions as of Feb 2026

## Visual observations

*1 Pareto frontier chart showing throughput/latency improvement across the full curve. Key numbers quoted above.*

## What this changes

Demonstrates that `torch.compile`-driven systematic fusion (vs. handcrafted per-op kernels) scales well for MoE serving on new hardware — reducing engineering overhead while delivering competitive performance. The Stream Interval pattern for high-concurrency CPU overhead is broadly applicable to any vLLM deployment.

## Entities touched

[[vLLM]], [[Blackwell]], [[B200]], [[GB200]], [[FlashInfer]], [[NVIDIA]], [[Torch Compile]], [[Expert Parallelism]]

## Topics touched

[[LLM Inference Systems]], [[MoE Serving]], [[Pareto Frontier Optimization]], [[Kernel Fusion]]

## Raw source

[mp.weixin.qq.com/2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par](https://mp.weixin.qq.com/s/NjDjQDy9t7EP0rH53GnRAA) — WeChat/vLLM official blog repost, original at blog.vllm.ai/2026/02/01/gpt-oss-optimizations.html. Read 2026-05-15.
