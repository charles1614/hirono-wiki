---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 3
---

# Low-Precision Training

## What

*Stub topic — to be expanded from sources.*

## Current understanding

*Synthesis pending. See Sources drawn on below.*

## Open threads

- (to be filled in)
- Native FP8 (Ironwood) vs emulated FP8 (TPU v4/v5p) — practical perf delta on real workloads (e.g. LLaMA 405B inference)? Useful for comparing Ironwood's listed FLOPS to real-workload throughput. — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]
- Does NVFP4 stability hold at 70B/405B model scale and at >10T-token training horizons? Outlier behavior in attention QK projections gets worse at scale; published validation is on a 12B model at 10T tokens. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Wall-clock NVFP4 training speedup vs FP8 on B200 — what's the real number? The abstract talks throughput in theory; the paper should report wall-clock. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Unified NVFP4 training + inference story emerging? FP4 inference already shipped in TRTLLM / vLLM FP8/INT4 paths; pretraining is the bigger claim. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Long-context FP8-vs-FP16 gain scaling — the HKUST H100 microbench used input=128, output=128, batch=8. Realistic workloads have much longer contexts; the precision tradeoff likely shifts. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]


## Sources drawn on

- (auto-populated by reindex)
