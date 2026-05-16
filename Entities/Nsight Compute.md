---
created: 2026-05-11
updated: 2026-05-16
type: entity
refs: 11
tier: active
---

# Nsight Compute

NVIDIA's kernel-level profiler; SM/warp metrics, source-line attribution; integrated with CUDA toolkit.

## Synthesis

*Regenerated from Observations below.*

## Observations

- `nsight-python` library wraps `ncu` CLI with a Python decorator API (`@nsight.analyze.kernel`, `@nsight.analyze.plot`), enabling parameter sweeps (`configs`), metric collection to pandas DataFrames, and optional matplotlib output. Two-pass model: script runs as launcher, `ncu` re-executes it, then `.ncu-rep` is parsed. `@plot` limited to one metric per call. H100 benchmarks in the post show matmul at n=2048 reaching ~50 TFLOPS. — [[2026-02-12-gvwwekyppgmtxdpex-qw]]
- Version 2025.4 (released alongside CUDA 13.1) adds [[CUDA Tile]] kernel profiling: new "Result Type" column distinguishing Tile vs SIMT kernels; "Tile Statistics" section covering Tile dimensions, launch config, and pipeline utilization; source page maps metrics back to high-level cuTile Python source. Also adds profiling of CUDA graph nodes from device-launched graphs and clickable label links for source navigation. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- Nsight Compute提供丰富硬件计数器和细粒度性能指标，但采集范围和触发条件在profiling前由硬件固定，用户可控程度有限——无法实现"第128个warpid花了多少时间"这类条件驱动查询；[[Neutrino]] PTX插桩框架作为补充，填补此细粒度可编程观测空白。 — [[2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针]]
- Huawei Ascend NPU的对应工具是Insight（功能类比Nsight），提供Python/CANN/AscendHardware/Communication/OverlapAnalysis等多层时序图，可观测从Python下发到CANN再到AscendHardware的时间滞后，以及stream事件排队（event wait）行为。 — [[2025-09-10-gpu-npu推理profiling阅读引导-下]]
- ncu incorrectly reports Tensor Pipe Utilization on L20 (SM89 Ada) and H20 GPUs due to wrong HMMA instruction latency assumptions: uses 16 cycles for `HMMA.16816.F32.BF16` (actual: 32 cycles) and 8 cycles for `HMMA.1688.F32` (actual: 16 cycles). A BF16 GEMM at 96.81% Roofline peak shows only 48.46% Tensor Pipe Utilization as a result. Workaround: derive expected utilization from peak FLOPS + measured instruction count rather than trusting Compute Workload Analysis directly. — [[2025-12-03-关于nsight-compute中compute-workload-analys]]
