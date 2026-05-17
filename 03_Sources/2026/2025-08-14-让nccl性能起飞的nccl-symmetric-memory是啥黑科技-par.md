---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/fsWGCkSFKHNKCDdjM69Ntw
tags: [training, parallelism, gpu, comm-overlap]
---

# [2025-08-12] 让NCCL性能起飞的NCCL symmetric memory是啥黑科技？— part1

## TL;DR

Deep technical dive into NCCL 2.27's symmetric memory feature, which enables low-latency intra-node collective kernels by mapping identical virtual address layouts across all local ranks via CUDA VMM (Virtual Memory Management) APIs, allowing direct pointer arithmetic across GPU memory spaces without IPC handle overhead.

## Key claims

- NCCL symmetric memory uses `ncclMemMalloc` (VMM-backed) + `ncclCommWindowRegister` to create a shared virtual address space where `baseUCSymPtr + rankID * baseStride + offset` resolves to the same physical memory as seen by all local ranks, enabling direct GPU-to-GPU pointer access without intermediate buffers.
- CUDA VMM (introduced in CUDA 10.2) decouples virtual addresses from physical memory via `cuMemAddressReserve` + `cuMemCreate` + `cuMemMap`; this eliminates cudaMalloc-style copy-and-realloc overhead for growing buffers (e.g., a 1GB→2GB expansion previously required 3GB concurrent footprint).
- Symmetric memory registration via `ncclCommWindowRegister` asynchronously processes a `ncclSymRegTask` queue: each rank calls `cuMemExportToShareableHandle`, exchanges handles via allgather, then `cuMemImportFromShareableHandle` + `cuMemMap` to establish full cross-rank visibility.
- `ncclComm` maintains two symmetric address spaces: `baseUCSymPtr` (UC, unicast; size = `baseStride * localRanks`) and `baseMCSymPtr` (MC, multicast for NVLS; size = `baseStride`); `baseStride` defaults to the maximum GPU memory across ranks (e.g., 96 GB).
- The AllGather offset requirement in user code arises because both input and output buffers must be placed at symmetric offsets — rank N's output slot is `baseUCSymPtr + N*stride + offset`, which other ranks can read without kernel parameters.
- Symmetric memory currently targets intra-node NVLink only; inter-node extension via IBGDA is planned (NCCL GitHub Issue #1615).
- Performance benchmark with `nccl-tests -R 2` shows small-message latency nearly at physical limit on NVL72 and DGX-H100 (NVL8).
- P2P\_DIRECT mode advantage in VMM context: single address space eliminates IPC handles; P2P access permissions set per-region via `cuMemSetAccess` rather than global `cudaDeviceEnablePeerAccess`.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par/weixin-img-001.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par/weixin-img-002.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par/weixin-img-013.png)

## What this changes

- Symmetric memory is the underlying primitive that makes low-latency AllReduce/AllGather kernels viable at small message sizes on NVLink domains.

## Entities touched

[[NCCL]], [[NVIDIA]], [[NVLink]], [[NVSwitch]], [[CUDA]], [[PyTorch Symmetric Memory]]

## Topics touched

[[GPU Memory Management]], [[Communication-Computation Overlap]], [[LLM Training Systems]], [[GPU Cluster Networking]]

## Raw source

[mp.weixin.qq.com/s/fsWGCkSFKHNKCDdjM69Ntw](https://mp.weixin.qq.com/s/fsWGCkSFKHNKCDdjM69Ntw) — WeChat公众号 黄randolf; 2025-08-12. Read 2026-05-15.
