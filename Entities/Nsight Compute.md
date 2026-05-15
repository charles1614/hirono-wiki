---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# Nsight Compute

NVIDIA's kernel-level profiler; SM/warp metrics, source-line attribution; integrated with CUDA toolkit.

## Synthesis

*Regenerated from Observations below.*

## Observations

- `nsight-python` library wraps `ncu` CLI with a Python decorator API (`@nsight.analyze.kernel`, `@nsight.analyze.plot`), enabling parameter sweeps (`configs`), metric collection to pandas DataFrames, and optional matplotlib output. Two-pass model: script runs as launcher, `ncu` re-executes it, then `.ncu-rep` is parsed. `@plot` limited to one metric per call. H100 benchmarks in the post show matmul at n=2048 reaching ~50 TFLOPS. — [[2026-02-12-gvwwekyppgmtxdpex-qw]]
- Version 2025.4 (released alongside CUDA 13.1) adds [[CUDA Tile]] kernel profiling: new "Result Type" column distinguishing Tile vs SIMT kernels; "Tile Statistics" section covering Tile dimensions, launch config, and pipeline utilization; source page maps metrics back to high-level cuTile Python source. Also adds profiling of CUDA graph nodes from device-launched graphs and clickable label links for source navigation. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- ncu incorrectly reports Tensor Pipe Utilization on L20 (SM89 Ada) and H20 GPUs due to wrong HMMA instruction latency assumptions: uses 16 cycles for `HMMA.16816.F32.BF16` (actual: 32 cycles) and 8 cycles for `HMMA.1688.F32` (actual: 16 cycles). A BF16 GEMM at 96.81% Roofline peak shows only 48.46% Tensor Pipe Utilization as a result. Workaround: derive expected utilization from peak FLOPS + measured instruction count rather than trusting Compute Workload Analysis directly. — [[2025-12-03-关于nsight-compute中compute-workload-analys]]
