---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/b9OmFbMopQ5TocNHgv1Xaw
tags: [training, gpu]
---

# [2025-06-01] 再议 Driver 和 Runtime APIs — CUDA两套API对比详解

## TL;DR

本文深入对比CUDA Driver API与Runtime API的设计模型，重点讲解Context管理、Module加载、共享内存优化、L2 cache持久化、锁页内存等核心机制，并介绍CUDA 12.0引入的context无关加载接口（`cuLibrary*`/`cuKernel*`）。

## Key claims

- [[CUDA Driver API]]（前缀`cu`）是基于句柄的命令式API，需手动调用`cuInit(0)`、`cuCtxCreate()`创建context，再通过`cuModuleLoad()`加载PTX或二进制；context与CPU进程类似，销毁时自动清理所有资源。
- [[CUDA Runtime API]]（前缀`cuda`）高度抽象：`cudaMalloc`/`cudaFree`/`cudaMemcpy`管理设备内存；Runtime在第一次激活时为每个设备隐式创建primary context并加载device code，程序员无需手动管理context。
- CUDA 12.0前：Module加载（`cuModuleLoad`）绑定到特定context，多设备场景下须为每个context分别加载模块，框架需维护`map<CUcontext, CUmodule>`状态，增加复杂度。
- CUDA 12.0后：`cuLibraryLoadFromFile`/`cuLibraryGetKernel`提供context无关加载——driver在context创建或初始化时自动完成module加载/卸载，框架只需一次`libraryInitialize()`/`libraryDeinitialize()`。
- 共享内存优化矩阵乘法：分块策略将A/B子矩阵加载到SMEM，全局内存访问次数从K次降至约K/TILE_SIZE次；需注意bank冲突与`__syncthreads()`线程同步。
- 锁页内存（pinned memory）通过`cudaHostAlloc()`分配，支持DMA直接访问、异步传输`cudaMemcpyAsync`，写组合模式（`cudaHostAllocWriteCombined`）进一步降低PCIe总线侦听开销。
- L2 cache访问管理（CUDA 11.0起）：可标记数据为"持久化"（repeated access）或"流式"（single access），提升频繁访问数据的缓存命中率。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[CUDA Driver API]], [[CUDA Runtime API]], [[CUDA]]

## Topics touched

[[GPU Programming Models]], [[GPU Memory Management]]

## Raw source

[mp.weixin.qq.com/s/b9OmFbMopQ5TocNHgv1Xaw](https://mp.weixin.qq.com/s/b9OmFbMopQ5TocNHgv1Xaw) — 月亮动物园 公众号，2025-06-01. Read 2026-05-16.
