---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://docs.nvidia.com/nsight-systems/InstallationGuide/index.html
tags: [observability, gpu, tooling]
---

# [2025-08-18] Installation Guide — Nsight Systems

## TL;DR

Official NVIDIA install reference for [[Nsight Systems]], a statistical CPU/GPU sampling profiler with tracing. Covers two editions (Workstation for x86_64/Arm SBSA; Embedded Platforms for Tegra/JetPack), supported OS and CUDA versions, CLI-vs-GUI install paths, and the "Advanced Analysis System" Python recipe layer. Primary audience: operators setting up profiling on Linux clusters, containers, or Windows workstations.

## Key claims

- **Two conceptual roles are always distinct**: the *target* (device being profiled) and the *host* (machine running the GUI and controlling the session). For x86_64 these may be the same machine; for Tegra/Arm SBSA they are always separate — the host pushes target binaries on first connection.
- **Two editions, distinct package sets**:
  - *Workstation Edition* — x86_64 and Arm SBSA (server/cluster/cloud); supports Linux (Ubuntu 22.04/24.04, RHEL/CentOS 8+, Amazon Linux 2023+) and Windows Server 2022+, plus macOS 13+ as host-only.
  - *Embedded Platforms Edition* — NVIDIA Tegra (Jetson/DRIVE) for embedded/automotive; L4T and QNX OSs. Available exclusively via JetPack SDK, not the standalone installer.
- **GPU architecture floor**: Turing and newer for x86_64/Arm SBSA. [[CUDA]] 10.0+ required; Arm SBSA needs 10.2+. Driver/toolkit must be paired per the published minimum table (e.g. CUDA 11.0 → driver ≥ 450).
- **CLI-only package is a first-class option**: separate `.deb`/`.rpm` packages (`nsight-systems-cli`) exist for Linux headless environments — useful for Docker containers and unattended collection over SSH. Arm SBSA targets can *only* be profiled via CLI (no GUI collection on Arm SBSA target).
- **Linux perf prerequisites**: IP-sample + thread-scheduling collection requires `perf_event_paranoid ≤ 2` and kernel ≥ 4.3 (Ubuntu/generic) or ≥ 3.10.0-693 (RHEL/CentOS 7.4+). glibc ≥ 2.17. Only pure 64-bit environments supported.
- **Package manager install** (Ubuntu/RHEL) is the recommended path for containers; the NVIDIA devtools repo hosts both `nsight-systems` (full) and `nsight-systems-cli` (headless). The CUDA Toolkit also bundles Nsight Systems for x86_64/Arm SBSA targets.
- **Environment self-check CLI**: `nsys status -e` reports perf paranoid level, kernel version, perf_event_open availability, and Intel LBR support — the first diagnostic step after install.
- **Advanced Analysis System** is a Python layer (Python 3.10+) shipped in `target-linux-x64/python/packages/nsys_recipe/`. Requires a venv; can be installed via automated script (`install.py --current|--venv|--download`) or manually from three requirements files (Common, Dask, Jupyter). An offline two-step wheel workflow is documented for air-gapped machines.
- **QNX safety environment** has restricted support — only five trace features (TraceLogger, Hypervisor, VMProfiler, OSRT, NVTX) available since 6.0.8.x; Nsight Systems is explicitly not safety-certified and must not be used in driving-decision environments.
- **CUDA Profiling Tools Interface (CUPTI)** is the underlying mechanism for CUDA Runtime/Driver API trace and GPU workload visibility. NVTX annotations (ranges, markers, thread names) are first-class in all editions.

## Visual observations

*No load-bearing images — source has no images*

## Entities touched

[[Nsight Systems]], [[NVIDIA]], [[CUDA]], [[Nsight Compute]]

## Topics touched

[[GPU Profiling]], [[Observability]]

## Raw source

[docs.nvidia.com/nsight-systems/InstallationGuide/index.html](https://docs.nvidia.com/nsight-systems/InstallationGuide/index.html) — HTML reference docs · ~11KB · fetched 2025-08-18. Text-only; no figures. Covers installation only; profiling workflows and CLI reference are in the companion User Guide.
