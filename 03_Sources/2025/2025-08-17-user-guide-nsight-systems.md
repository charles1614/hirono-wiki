---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://docs.nvidia.com/nsight-systems/UserGuide/index.html#exporting-and-querying-data
tags: [observability, gpu, tooling]
---

# [2025-08-17] User Guide — Nsight Systems

## TL;DR

Reference manual for [[Nsight Systems]]' CLI and profiling workflows. Covers: focused-profiling scope control (`cudaProfilerStart/Stop`, NVTX capture ranges), the full `nsys profile` option surface, post-collection commands (`stats`, `export`, `analyze`, `recipe`), multi-node MPI/DeepSpeed/torchrun patterns, Python/PyTorch profiling, NCCL/MPI/UCX network tracing, and the GUI Timeline View. Complements the installation guide (editions, package install, CUPTI/NVTX mechanisms) — this guide is the usage layer.

## Key claims

- **`nsys profile` is the primary collection command**; default run traces CUDA, OpenGL, NVTX, OS runtime APIs and collects CPU IP sampling + thread scheduling. Output is `report#.nsys-rep`. Post-run `nsys stats` / `nsys export` / `nsys analyze` operate on `.nsys-rep` or `.sqlite` files without re-running the application.
- **Focused profiling reduces noise**; two mechanisms: `cudaProfilerStart()`/`cudaProfilerStop()` to gate CUDA data collection, and NVTX capture ranges (`--capture-range=nvtx -p MESSAGE@DOMAIN`) to start/stop on user-injected annotations. `--delay` / `--duration` are the time-based alternatives.
- **NVTX (NVIDIA Tools Extension) v3.0** is the canonical instrumentation API: push-pop ranges (`nvtxRangePushEx`/`nvtxRangePop`), start-end ranges, marks, and domain isolation (`nvtxDomainCreate`). Appears in the Timeline View as labelled spans overlaid on GPU activity. `--nvtx-domain-include` / `--nvtx-domain-exclude` filter domains at collection time.
- **Multi-node profiling pattern**: CLI must be prefixed before the *application* (not the launcher). For MPI: `mpirun [args] nsys profile [nsys args] <app>`; for DeepSpeed: wrapper script + `deepspeed --no_python ./nsys_profile.sh`; for torchrun: per-rank conditional in the launch script. `%q{OMPI_COMM_WORLD_RANK}` / `%p` in `-o` embeds rank/PID in the output filename to prevent file collisions.
- **Network communication tracing**: `--trace=mpi` (Open MPI or MPICH, auto-detected), `--trace=nccl` for [[NCCL]] collective ops, `--trace=ucx` for UCX-layer comms, `--trace=nvtx` as a fallback via NVTX-wrappers-for-MPI. All four are relevant for multi-GPU distributed training/serving visibility.
- **Python profiling suite**: backtrace sampling (`--python-sampling`, 1Hz–2KHz, CPython 3.9+); Python Functions Trace (`--python-functions-trace=<json>`, no source changes, CPython 3.8+); GIL tracing (`--trace=python-gil`); PyTorch auto-annotation (`--pytorch=autograd-nvtx` or `functions-trace`; no source changes, uses predefined `pytorch.json`). PyTorch `functions-trace` logs forward/backward/step shapes.
- **GPU Metrics sampling** (`--gpu-metrics-devices`, `--gpu-metrics-frequency`, `--gpu-metrics-set`): periodic hardware counter collection alongside the event trace. Distinct from the kernel-level depth offered by [[Nsight Compute]] — Nsight Systems gives timeline placement, Nsight Compute gives SM/memory/warp attribution.
- **Export formats**: `--export sqlite` writes a queryable SQLite schema (`nsys export`); formats also include Arrow, Parquet, HDF5, JSON Lines, and text. `nsys stats` generates summary statistics from `.nsys-rep` or `.sqlite` without a full GUI. `nsys recipe` produces statistical reports and plots (see Post-Collection Analysis Guide).
- **Container and scheduler support**: Nsight Systems can collect inside Docker/Podman (privileges required: `--privileged` or specific capabilities); cloud and SLURM profiling follow the multi-node pattern above.
- **`nsys status -e`** is the pre-flight environment check (perf paranoid, kernel version, LBR support) — same command recommended in the installation guide for post-install validation.

## Visual observations

*No load-bearing images — source is a large HTML reference manual; screenshots illustrate GUI panels, not quantitative data*

## Entities touched

[[Nsight Systems]], [[NVIDIA]], [[CUDA]], [[Nsight Compute]], [[NCCL]]

## Topics touched

[[GPU Profiling]], [[Observability]]

## Raw source

[docs.nvidia.com/nsight-systems/UserGuide/](https://docs.nvidia.com/nsight-systems/UserGuide/index.html#exporting-and-querying-data) — HTML reference docs · ~444KB · fetched 2025-08-17. Comprehensive; covers CLI, GUI, Windows/Linux/QNX targets, every trace module (CUDA, NVTX, OpenGL, Vulkan, DX12, MPI, NCCL, UCX, NVSHMEM, OpenACC, OpenMP, Python, network hardware). Pair with [[2025-08-18-installation-guide-nsight-systems]] for setup context.
