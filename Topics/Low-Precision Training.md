---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 3
---

# Low-Precision Training

## What

Pretraining and continued-pretraining of foundation models in narrow numeric formats — FP8, FP4, [[NVFP4]], BF16 — to reduce compute and memory footprint while preserving quality. Distinct from quantization-for-inference: training in low precision means the loss-landscape navigation itself happens in the narrower format, so stability is a different problem (outlier blow-up, unbiased gradient updates, backward-pass consistency). The 2025-2026 frontier is **4-bit training**.

## Current understanding

**The headline result**: NVFP4 ([[2026-02-04-pretraining-large-language-models-with-n]], 89-author NVIDIA paper Sep 2025 / v2 Mar 2026) demonstrates **the first publicly documented 12B-parameter LLM pretrained on 10 trillion tokens in 4-bit precision matching FP8 quality**. This is the longest 4-bit pretraining run ever published and the existence proof that justifies Blackwell's native FP4 silicon investment.

**The four-ingredient recipe** for stable FP4 training:

1. **Random Hadamard transforms (RHT)** applied per-block to bound outliers. The Hadamard matrix mixes block elements so heavy-tail mass spreads, making block-scale FP4 quantization accurate.
2. **2-D quantization scheme** for forward/backward consistency. Prior FP4 schemes worked forward-only because matmul transposes change the scale structure on the backward path.
3. **Stochastic rounding** for gradient updates — preserves expected value across millions of steps. Deterministic rounding biases gradients near the quantization boundary; bias accumulates.
4. **Selective high-precision layers** — strategic FP8/BF16 retention for the stability-critical operators (embedding, layer-norm, final softmax).

**FP8 → FP4 is the standard density doubling on Tensor-Core hardware**. Hopper's FP8 ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] HKUST microbench) is the qualitative LLM-acceleration jump from prior Tensor-Core precisions (FP16 → BF16/TF32 → FP8). Blackwell's FP4 ([[NVFP4]] specifically; distinct from generic E2M1 because of NVIDIA's block-scale + scale-factor encoding) is the next doubling. **Native FP8 on Ironwood** ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) closes the TPU side: TPU v4/v5p emulated FP8; Ironwood is native.

**The competitive framing**:
- Google's positioning ([[Accelerator Economics]] Topic): perf-per-watt via vertical-stack integration; Ironwood as the inference-first chip.
- NVIDIA's counter: NVFP4 doubles effective Blackwell throughput at FP8-equivalent quality. The 89-author paper is the technical backbone of the cap-ex argument.

**HKUST microbenchmark caveats** on FP8 in practice ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]): Transformer Engine's FP8 path is **not end-to-end** — `te.Linear` is fully FP8-quantized but Softmax/GeLU stay BF16 (data-format-conversion overhead), and `te.DotProductAttention` bypasses FP8 TC entirely. The headline 2× FP8-vs-FP16 speedup is achievable only on linear-dominated workloads. Whether these limits still hold in 2025/2026 TE versions is an open thread.

**Open threads** (active across this Topic):
- NVFP4 stability at 70B/405B model scale and >10T-token horizons — outlier behavior in attention QK projections gets worse at scale; published validation is at 12B / 10T.
- Wall-clock NVFP4 training speedup vs FP8 on B200 — paper reports theoretical throughput; real wall-clock is the load-bearing number for cap-ex planning.
- Unified NVFP4 training + inference story emerging? FP4 inference already shipped in TRTLLM and vLLM FP8/INT4 paths; pretraining-with-quality-parity is the qualitatively bigger claim.

## Sources drawn on

- [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — native FP8 on Ironwood (vs emulated on v4/v5p); reference for the TPU-side low-precision trajectory.
- [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] — HKUST Hopper microbench; canonical FP8/TE-limits + Tensor-Core precision-cross-comparison.
- [[2026-02-04-pretraining-large-language-models-with-n]] — NVFP4 four-ingredient method + 12B/10T validation; the load-bearing 4-bit-training existence proof.

## Open threads

- (to be filled in)
- Native FP8 (Ironwood) vs emulated FP8 (TPU v4/v5p) — practical perf delta on real workloads (e.g. LLaMA 405B inference)? Useful for comparing Ironwood's listed FLOPS to real-workload throughput. — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]
- Does NVFP4 stability hold at 70B/405B model scale and at >10T-token training horizons? Outlier behavior in attention QK projections gets worse at scale; published validation is on a 12B model at 10T tokens. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Wall-clock NVFP4 training speedup vs FP8 on B200 — what's the real number? The abstract talks throughput in theory; the paper should report wall-clock. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Unified NVFP4 training + inference story emerging? FP4 inference already shipped in TRTLLM / vLLM FP8/INT4 paths; pretraining is the bigger claim. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Long-context FP8-vs-FP16 gain scaling — the HKUST H100 microbench used input=128, output=128, batch=8. Realistic workloads have much longer contexts; the precision tradeoff likely shifts. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]


## Sources drawn on

- (auto-populated by reindex)
