---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/720562971
tags: [inference, observability, gpu, microbenchmark]
---

# [2025-08-03] 关于Nsight Compute中Compute Workload Analysis反映的Tensor Pipe Utilization的理解

## TL;DR

Analysis showing that Nsight Compute (ncu) incorrectly reports Tensor Pipe Utilization on L20 (SM89 Ada) and H20 GPUs due to using wrong instruction latencies. A BF16 GEMM Kernel achieving 96.81% Roofline peak shows only 48.46% Tensor Pipe Utilization — the discrepancy is caused by ncu using a 16-cycle latency for `HMMA.16816.F32.BF16` on L20, when the correct value is 32 cycles.

## Key claims

- On L20 (SM89 Ada Architecture), the `HMMA.16816.F32.BF16` instruction's actual execution latency is **32 cycles**, derived from: `CPI = 4096 × 2520 MHz / (119 TFlops / 368 Tensor Cores) ≈ 32`.
- ncu calculates Tensor Pipe Utilization as `(instruction_count × assumed_CPI) / SMSP_active_cycles`; for L20 it assumes CPI=16 instead of 32, halving the reported utilization.
- Reverse-validation: `11,854,369.63 × 0.4846 / 359,023.30 ≈ 16` — confirms ncu's erroneous 16-cycle assumption.
- At the correct 32-cycle CPI: `32 × 359,023 / 11,854,370 ≈ 96.92%` Tensor Pipe Utilization, consistent with the Roofline peak.
- Same bug exists for FP16 `HMMA.1688.F32`: ncu assumes 8 cycles on L20, actual is 16 cycles.
- RTX 4090 (Ada) benchmark paper measured `HMMA.16816.F32` at 33 cycles, corroborating the analysis.
- Recommendation: start from Roofline (Memory Bound vs. Compute Bound) rather than raw Compute Workload Analysis metrics on newer/special GPUs like L20, H20.

## Visual observations

![](../../raw/raindrop/zhuanlan.zhihu.com/2025-12-03-关于nsight-compute中compute-workload-analys/zhihu-img-001.jpg)

![](../../raw/raindrop/zhuanlan.zhihu.com/2025-12-03-关于nsight-compute中compute-workload-analys/zhihu-img-002.jpg)

*Other images decorative — workload distribution chart, peak flops derivation table.*

## What this changes

Documents a systematic ncu instrumentation bug on L20/H20 GPUs that can mislead kernel optimization efforts; establishes a reverse-validation methodology for checking profiler metric accuracy.

## Entities touched

[[Nsight Compute]]

## Topics touched

[[GPU Profiling]]

## Raw source

[zhuanlan.zhihu.com/p/720562971](https://zhuanlan.zhihu.com/p/720562971) — Zhihu article by Anonymous; published 2025-08-03. Read 2026-05-15.
