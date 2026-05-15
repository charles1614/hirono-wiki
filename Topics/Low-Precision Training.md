---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 3
---

# Low-Precision Training

## What

Pretraining and continued-pretraining of foundation models in narrow numeric formats — FP8, FP4, [[NVFP4]], BF16 — to reduce compute and memory footprint while preserving quality. Distinct from quantization-for-inference: training in low precision means the loss-landscape navigation itself happens in the narrower format, so stability is a different problem (outlier blow-up, unbiased gradient updates, backward-pass consistency). The 2025-2026 frontier is **4-bit training**.

## Current understanding

The frontier of low-precision training has moved decisively from FP8 to **FP4** as the 2025–2026 research target. The headline existence proof is NVIDIA's 89-author paper [[2026-02-04-pretraining-large-language-models-with-n]]: a 12B-parameter LLM trained on 10 trillion tokens in **NVFP4** matches FP8 training loss and downstream accuracy — the longest 4-bit pretraining run publicly documented and the technical backbone for Blackwell's native FP4 silicon investment.

**Stable FP4 training requires four co-design ingredients**, all of which are absent in naive quantization: (1) **Random Hadamard transforms (RHT)** applied per-block to suppress heavy-tail outliers before block-scale quantization; (2) a **2-D quantization scheme** that keeps forward and backward representations consistent (matmul transposes break naive FP4 schemes on the backward path); (3) **stochastic rounding** for gradient updates to preserve unbiased expected values across millions of steps (deterministic rounding accumulates boundary bias); and (4) **selective high-precision retention** of stability-critical operators — embedding, layer-norm, and final softmax in FP8 or BF16. The stability problem is qualitatively harder than inference-only quantization: the loss-landscape traversal itself happens in the narrow format, so gradient corruption or outlier blow-up directly degrades convergence [[2026-02-04-pretraining-large-language-models-with-n]].

**FP8 → FP4 is the standard tensor-core density doubling step**, mirroring the earlier FP16 → FP8 transition on Hopper. The HKUST microbenchmark study [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] documents that Hopper's FP8 was already the qualitative LLM-training jump over prior precisions — but also exposes that the **Transformer Engine FP8 path is not end-to-end**: `te.Linear` is fully FP8-quantized, but Softmax and GeLU remain BF16 (data-format-conversion overhead), and `te.DotProductAttention` bypasses FP8 Tensor Cores entirely via FlashAttention. The practical headline is that 2× FP8-vs-FP16 speedups are achievable only on linear-dominated workloads, not generically across a Transformer layer. Whether 2025/2026 Transformer Engine versions have closed these gaps is an open question.

On the **TPU side**, Google's Ironwood ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) establishes that FP8 is now native on v7 — v4 and v5p emulated FP8 at a performance tax. The significance for this topic: Ironwood's native FP8 closes the TPU-side gap just as Blackwell introduces native FP4. Google's positioning (perf/watt via vertical-stack integration) contrasts with NVIDIA's throughput-density story (FP4 doubles effective Blackwell throughput at FP8-quality), but both chip families are converging on narrower formats as the primary lever for training and inference economics.

**Where sources agree**: block-scale quantization + RHT + stochastic rounding is the emerging recipe for sub-FP8 training stability; hardware-native support for the target precision is load-bearing (software emulation incurs a real tax, as HKUST quantifies for TE FP8); and the transition from FP8 to FP4 in hardware mirrors the prior FP16 → FP8 arc.

**Where the record is incomplete**: the NVFP4 result is validated at 12B / 10T only — outlier behavior in attention QK projections worsens at scale, and the paper's stability claims have not been reproduced at 70B or 405B parameters. Wall-clock training speedup of NVFP4 vs FP8 on B200 hardware is unreported (the paper quantifies theoretical throughput); that number is the load-bearing input for cap-ex planning. The TE limitations documented by HKUST may have been partially addressed in more recent TE releases, but no corpus source confirms this.

## Comparison

| Axis | BF16 | FP8 | FP4 / NVFP4 |
|---|---|---|---|
| **Tensor-core arithmetic density vs BF16** | 1× (baseline) | ~2× on linear-dominated workloads ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]) | ~2× vs FP8 (doubles arithmetic density on Blackwell tensor cores) ([[2026-02-04-pretraining-large-language-models-with-n]]) |
| **NVIDIA hardware — native support** | Ampere+ (A100, H100, B200) | Hopper+ (H100) native; Ampere emulated ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]) | Blackwell (B200/GB200) native; not available on Hopper ([[2026-02-04-pretraining-large-language-models-with-n]]) |
| **Google TPU — native support** | v4+ | Ironwood (v7) native; v4/v5p emulated at a performance tax ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | N/A — no TPU FP4 silicon announced in corpus |
| **Training stability requirements** | None (baseline) | Transformer Engine auto-scaling; Softmax/GeLU stay BF16 ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]) | RHT per-block + 2-D quantization scheme + stochastic rounding + selective hi-precision layers ([[2026-02-04-pretraining-large-language-models-with-n]]) |
| **Transformer Engine operator coverage** | N/A | `te.Linear` fully FP8; Softmax + GeLU remain BF16; `te.DotProductAttention` bypasses FP8 TC via FlashAttention ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]) | ? (Blackwell TE integration not yet described in corpus) |
| **Validated pretraining scale** | Routine across full model-size range | Widely used for 7B–70B runs; industry standard 2024–2025 | 12B / 10T tokens — longest published run ([[2026-02-04-pretraining-large-language-models-with-n]]); 70B+ not validated in corpus |
| **Backward-pass consistency** | No special handling | Standard TE scaling; no matmul-transpose issue at FP8 granularity | Requires explicit 2-D quantization — naive FP4 fails on backward path due to matmul-transpose scale mismatch ([[2026-02-04-pretraining-large-language-models-with-n]]) |
| **Gradient bias risk** | None | Low (sufficient dynamic range at FP8) | Requires stochastic rounding — deterministic rounding accumulates boundary bias over millions of steps ([[2026-02-04-pretraining-large-language-models-with-n]]) |
| **Wall-clock training speedup vs BF16** | 1× | Up to ~2× on linear-heavy workloads; lower end-to-end due to TE operator gaps ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]) | ? (theoretical ~4× vs BF16 implied; wall-clock on B200 unreported in corpus) |

## Open threads

- Native FP8 (Ironwood) vs emulated FP8 (TPU v4/v5p) — practical perf delta on real workloads (e.g. LLaMA 405B inference)? Useful for comparing Ironwood's listed FLOPS to real-workload throughput. — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]
- Does NVFP4 stability hold at 70B/405B model scale and at >10T-token training horizons? Outlier behavior in attention QK projections gets worse at scale; published validation is on a 12B model at 10T tokens. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Wall-clock NVFP4 training speedup vs FP8 on B200 — what's the real number? The abstract talks throughput in theory; the paper should report wall-clock. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Unified NVFP4 training + inference story emerging? FP4 inference already shipped in TRTLLM / vLLM FP8/INT4 paths; pretraining is the bigger claim. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Long-context FP8-vs-FP16 gain scaling — the HKUST H100 microbench used input=128, output=128, batch=8. Realistic workloads have much longer contexts; the precision tradeoff likely shifts. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]

## Sources drawn on

- [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — native FP8 on Ironwood (vs emulated on v4/v5p); reference for the TPU-side low-precision trajectory.
- [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] — HKUST Hopper microbench; canonical FP8/TE-limits + Tensor-Core precision-cross-comparison.
- [[2026-02-04-pretraining-large-language-models-with-n]] — NVFP4 four-ingredient method + 12B/10T validation; the load-bearing 4-bit-training existence proof.

