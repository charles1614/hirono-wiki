---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/gVW2weKypPgMtxdpex_q1w
tags: [inference, observability]
---

# [2026-02-12] Nsight Python 简介

## TL;DR
A hands-on walkthrough of NVIDIA's `nsight-python` library, which wraps Nsight Compute CLI (`ncu`) with a Python API for CUDA kernel profiling: decorator-based annotation, parameter sweeps, pandas DataFrame output, and optional matplotlib visualization. The author notes potential for pairing `nsight-python` with agent Skills to enable automated kernel optimization workflows.

## Key claims
- `nsight-python` uses a two-pass "launcher re-exec" model: the first run launches `ncu` to re-execute the script, then parses the `.ncu-rep` report.- `@nsight.analyze.kernel` supports `configs` (parameter sweep), `runs` (repetitions), `metrics` (list of `ncu` metric names), `derive_metric` (custom scalar or dict), `normalize_against`, `replay_mode`, and `combine_kernel_metrics`.- `@nsight.analyze.plot` is limited to visualizing one metric per call; multi-metric results require separate `@kernel` functions or `derive_metric` aggregation.- Benchmarked on H100: matmul at n=2048 shows ~50 TFLOPS and arithmetic intensity of 341; `dram__throughput.avg.pct_of_peak_sustained_elapsed` ~2.96% for `@-operator` (slightly higher coefficient of variation than `torch.matmul`).- The author proposes wrapping key metric-collection scripts into Claude Skills so agents can profile, read results, and iterate on kernel code without manually invoking `ncu` or parsing `.ncu-rep` binary files.- Library requires Python 3.10+, CUDA GPU, `ncu` on PATH, and PyTorch; Triton support is optional (only example 07).
## Visual observations
*10 local images (weixin-img-001.png through weixin-img-010.png): benchmark output plots from examples 01–11 (throughput comparison bars, parameter sweep lines, TFLOPS/arithmetic intensity curves, multi-parameter facet grids, Triton speedup chart, combined metric charts, CSV output view). Charts show H100 benchmark results — numbers above are from prose/code output, not image OCR.*

## What this changes
Introduces a Python-native ergonomic wrapper over `ncu` that makes kernel benchmarking scriptable and DataFame-queryable, lowering the bar for automated profiling loops. The agent+Skills angle points toward agentic kernel authoring workflows where profiling feedback is programmatic rather than manual.

## Entities touched
[[Nsight Compute]], [[CUDA]]

## Topics touched
[[GPU Profiling]], [[Kernel Authoring]], [[Agentic AI Infrastructure]]

## Raw source
[mp.weixin.qq.com/2026-02-12-gvwwekyppgmtxdpex-qw](https://mp.weixin.qq.com/s/gVW2weKypPgMtxdpex_q1w) — WeChat公众号 "GiantPandaLLM", published 2026-02-12. Read 2026-05-15.
