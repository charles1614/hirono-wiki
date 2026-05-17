---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/H65eoS-GAgJzpzV_p3SsGw
tags: [training, parallelism, gpu]
---

# [2025-06-08] NCCL源码解析8 — Kernel Launch流程

## TL;DR

本文梳理[[NCCL]]中kernel launch的完整流程：从`generate.py`脚本动态生成五维笛卡尔积kernel定义，到P2P SendRecv与ReduceScatter两种典型路径的kernel查找、注册与cuLaunchKernel调用链。

## Key claims

- NCCL kernel函数定义由`src/device/generate.py`在编译时动态生成，组合维度为：colls（通信操作）× ops（规约操作）× type（数据类型）× proto（协议）× algo（算法），是这五种的笛卡尔积，源码中无法直接搜索到。
- 生成文件在`./build/obj/device/gensrc/`目录下；关键文件：`host_table.cc`定义`ncclDevKernelForFunc`（global函数数组）和`ncclDevFuncRowToId`（行号映射），`device_table.cu`定义`ncclDevFuncTable`（device函数数组）。
- 宏`DEFINE_ncclDevKernel`和`DEFINE_ncclDevFunc`分别定义global和device函数；以SendRecv为例，生成`ncclDevKernel_SendRecv`，其specializedFnId为554，对应`ncclDevKernelForFunc[554]`。
- P2P路径：`scheduleP2pTasksToPlan`中通过`ncclDevFuncId_P2p()`→`ncclDevFuncRowToId[0]=554`→`ncclDevKernelForFunc[554]`确定kernel函数；最终在`ncclLaunchKernel`中通过`cudaGetFuncBySymbol`获取函数句柄，再调用`cuLaunchKernel`。
- ReduceScatter路径：通过`scheduleCollTasksToPlan`设置kernel，通过specializedFnId匹配或回退到`ncclDevFuncTable[funcId]()`通用分发路径。
- `ncclKernelMain`模板核心逻辑：若`ncclShmem.funcId == SpecializedFnId`则调用特化`SpecializedRunWorkBatch().run()`，否则走通用`ncclDevFuncTable`动态分发，实现特化与通用的统一入口。
- NCCL源码阅读的三大难点：多线程多并发（rank并行+proxy线程协调+CPU-kernel并行）；大量C++模板与宏定义；大量函数是动态生成的。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[NCCL]], [[CUDA]]

## Topics touched

[[GPU Kernel Scheduling]], [[GPU Programming Models]]

## Raw source

[mp.weixin.qq.com/s/H65eoS-GAgJzpzV_p3SsGw](https://mp.weixin.qq.com/s/H65eoS-GAgJzpzV_p3SsGw) — 网络虚拟化技术 公众号，2025-06-08. Read 2026-05-16.
