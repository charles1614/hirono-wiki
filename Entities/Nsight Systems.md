---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 16
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
- Interactive Nsys profiling for SGLang Server: use `--start-later` when launching the server to enter delayed mode, then `nsys start/stop --session=<id>` to control capture windows without restarting the server; supports multiple start/stop cycles in a single run. Complements SGLang's HTTP `/start_profile` + `/stop_profile` for PyTorch Profiler. — [[2026-02-10-sglang-server交互式profiling的一些技巧-pytorch-n]]
- Huawei Ascend NPU的对应工具Insight（类比Nsight Systems）以DeepSeek V3为例展示三层时序（Python/CANN/AscendHardware）+Communication/OverlapAnalysis等辅助视图；支持带/不带堆栈两种采集模式，带堆栈类似py-spy火焰图；采集多个step可观测step间主机下发/尾端处理时间及device空闲时间。 — [[2025-09-10-gpu-npu推理profiling阅读引导-下]]
- 系统性定位两框架性能差异的方法论：用`nsys profile --trace-fork-before-exec=true --cuda-graph-trace=node --force-overwrite=true`采集profile，在Windows/Mac端GUI打开，固定同一step同一layer的两个FlashAttention kernel作为时间线左右端点，逐一对比中间每个kernel；AI无法有效阅读Nsight profile结果，需人工基于经验分析。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
- [[Nsight Systems]] 实战采集要点：采集时长控制在 60s 以内；多节点共享存储需在输出文件名中嵌入 hostname 防覆盖；非管理员权限采集 CPU 详细信息需先执行 `echo 0 | sudo tee /proc/sys/kernel/perf_event_paranoid`；平台调度场景建议使用 Launch 模式（`nsys launch`+`nsys start/stop`）防 pod 被杀；nsys 版本需与当前 CUDA 环境发布时间基本一致，版本不匹配有兼容性问题。 — [[2025-09-19-nsight-systems工具原理与gpu性能优化实战详解]]
- Ray-based RL framework integration (verl, NVIDIA): standard `nsys <app>` fails for Ray programs because the application argument is just a submit command — actual compute runs on remote nodes. Solution: inject `runtime_env={"nsight": {...}}` at RayActor construction time. Ray saves traces to non-configurable `/tmp/ray/session_*/logs/{profiler_name}`; verl prints controller hostname+PID for location. Multi-report view enables importing controller + all workers together with auto-time-alignment. — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
- NVIDIA salon recipe for verl+GRPO profiling: `DISCRETE=True` creates one nsys file per sub-phase per worker (named `worker_process_{pid}.nsys-rep` with `{1-4}` suffix for rollout/log_prob/reference/actor_training); `PROFILE_RANKS_ALL=False` + `PROFILE_RANKS=[0,4]` for selective rank coverage; use Nsight GUI "New multi-report view" to reassemble a complete step from discrete files. — [[2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔]]
