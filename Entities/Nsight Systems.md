---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Nsight Systems

NVIDIA's system-level statistical profiler + tracer for GPU/CPU workloads

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- System-level statistical sampling profiler + tracer for [[CUDA]]-enabled targets (Tegra/Arm SBSA/x86_64); ships in two editions — Workstation (cluster/cloud) and Embedded Platforms (Jetson/DRIVE QNX). Target binaries are pushed from the host on first connection; no target-side install needed. — [[2025-08-18-installation-guide-nsight-systems]]
- Arm SBSA targets support CLI collection only (no GUI on-target); CLI-only `.deb`/`.rpm` packages available for headless/container deployments. `nsys status -e` is the canonical post-install environment check. — [[2025-08-18-installation-guide-nsight-systems]]
- Uses CUPTI for CUDA Runtime/Driver API trace and GPU workload visibility; NVTX annotations (ranges, markers, thread names) are first-class in all editions; pairs with [[Nsight Compute]] for kernel-level depth. — [[2025-08-18-installation-guide-nsight-systems]]
- Version 2025.6.1 (released alongside CUDA 13.1): system-wide CUDA trace via `--cuda-trace-scope` across process trees; CUDA Graph host function node trace (`cudaLaunchHostFunc`); hardware-based CUDA tracing now the default (use `--trace=cuda-sw` to revert); green context timeline rows show SM allocation in tooltips. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- `nsys profile` is the primary collection entry-point; post-collection commands (`stats`, `export`, `analyze`, `recipe`) operate on `.nsys-rep` or `.sqlite` files. Export targets: SQLite (queryable schema), Arrow, Parquet, HDF5, JSON Lines. `nsys stats` generates summary statistics headlessly. — [[2025-08-17-user-guide-nsight-systems]]
- Focused profiling via NVTX capture ranges (`--capture-range=nvtx -p MESSAGE@DOMAIN`) or `cudaProfilerStart/Stop`; `--delay`/`--duration` for time-bounded collection. NVTX v3.0 supported: push-pop ranges, start-end ranges, marks, domain isolation. — [[2025-08-17-user-guide-nsight-systems]]
- Multi-node profiling pattern for MPI/DeepSpeed/torchrun: CLI prefixed before the *application*, not the launcher; rank/PID embedded in output filename via `%q{OMPI_COMM_WORLD_RANK}` / `%p` to prevent collisions. Network trace modules: `--trace=mpi` (Open MPI/MPICH), `--trace=nccl`, `--trace=ucx`, `--trace=nvtx` (NVTX-MPI wrappers fallback). — [[2025-08-17-user-guide-nsight-systems]]
- Python profiling suite: backtrace sampling (1Hz–2KHz, CPython 3.9+), Python Functions Trace (JSON-configured, no source changes), GIL tracing, PyTorch auto-annotation (`--pytorch=autograd-nvtx` or `functions-trace` with shape logging); Dask annotation also supported. — [[2025-08-17-user-guide-nsight-systems]]
