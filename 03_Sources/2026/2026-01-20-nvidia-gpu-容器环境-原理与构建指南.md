---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/FcK3QmzudPZzqsz85odFlQ
tags: [inference, production-deployment, gpu, tooling]
---

# [2026-01-20] NVIDIA GPU 容器环境：原理与构建指南

## TL;DR

Practical reference for the host/container responsibility split in GPU containerization: the host manages drivers and the Container Toolkit, the container manages CUDA runtime and application stacks. The NVIDIA Container Runtime (formerly nvidia-docker) handles device mounting and library injection transparently at container start.

## Key claims

- The architectural principle is strict separation: the host installs the NVIDIA GPU driver (kernel modules `nvidia.ko`, `nvidia_uvm.ko`, user-space `libcuda.so`, `libnvidia-ml.so`) and NVIDIA Container Toolkit; the container installs CUDA Runtime/Toolkit, cuDNN, NCCL, and the application framework (PyTorch, TensorFlow, etc.).
- `nvidia-container-runtime` is a lightweight OCI-compatible wrapper around runC that injects a `prestart` hook; the hook calls `nvidia-container-cli` to (1) mount GPU device nodes (`/dev/nvidia0`, `/dev/nvidiactl`) into the container's `/dev/`, (2) inject driver libraries (`libcuda.so`, `libnvidia-ml.so`) via `ld.so.conf`, and (3) configure Device Cgroups for resource isolation.
- Three CUDA image variants cover distinct use cases: `base` (libcudart only — run pre-compiled binaries), `runtime` (base + cuBLAS/cuDNN — inference/training), `devel` (runtime + nvcc + headers — build custom CUDA operators).
- `libcuda.so` must NOT be installed in the container image — it is driver-version-specific and is always dynamically injected by the runtime; similarly, NVIDIA driver, kernel modules, and DKMS are host-only components.
- GPU-specific containers can be controlled via `--gpus '"device=0,2"'` (select GPUs), environment variable `NVIDIA_VISIBLE_DEVICES`, or capability flags `'all,"capabilities=compute,utility"'` to restrict library injection scope.

## Visual observations

![flowchart-v2](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2026-01-20-nvidia-gpu-容器环境-原理与构建指南/weixin-svg-001.svg)

*SVG flowchart showing the full runtime call chain from container startup through nvidia-container-runtime → nvidia-container-cli → device mount + library inject → libcuda.so → kernel driver → physical GPU.*

## Entities touched

[[NVIDIA]], [[CUDA]]

## Topics touched

[[GPU Memory Management]], [[Python Concurrency]]

## Raw source

[mp.weixin.qq.com/s/FcK3QmzudPZzqsz85odFlQ](https://mp.weixin.qq.com/s/FcK3QmzudPZzqsz85odFlQ) — WeChat public account "AI 原力注入"; published 2026-01-20. Read 2026-05-15.
