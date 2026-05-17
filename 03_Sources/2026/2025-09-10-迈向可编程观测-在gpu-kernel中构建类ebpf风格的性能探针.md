---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/FWeqR5ADU7RU7ZASkmtnTw
tags: [inference, observability, tooling, gpu]
---

# [2025-09-08] 迈向可编程观测：在GPU Kernel中构建类eBPF风格的性能探针

## TL;DR

阿里云工程师介绍如何通过PTX动态插桩框架Neutrino在GPU Kernel中实现"编译后插桩+运行时观测"的可编程性能探针，弥补Nsight Compute无法按条件/自定义触发的局限；文章从CUDA基础、PTX汇编入门到Neutrino框架架构全面展开，并以矩阵乘法GEMM为例演示共享内存Tiling优化及bank conflict减少的实测效果。

## Key claims

- [[Nsight Compute]]提供丰富硬件计数器但采集范围在profiling前由硬件固定，无法实现"某个Kernel中第128个warpid花了多少时间"这类条件驱动的细粒度查询；[[Neutrino]]框架填补此空白，在PTX层实现"GPU版eBPF"。
- Neutrino三要素类比eBPF：Snippet（探针代码体，PTX汇编）+ Tracepoint（触发时机）+ Map（结构化结果存储）；探针代码与原始Kernel寄存器完全隔离，按线程分配独立Map存储区域，保证无侵入性。
- Neutrino通过LD_PRELOAD劫持GPU驱动API，拦截Kernel二进制 → 反编译为汇编 → 插入探针指令 → 重汇编为可执行binary，整个过程对目标程序透明。
- 原始GEMM的非合并访问（A矩阵B[i*N+col]寻址导致每次跨4096字节）使全局内存ld事务达1.677亿次；引入共享内存Tiling后降至838万次（约5%），全局内存读数据量从5GB降至0.25GB。
- Tiling优化后Average Running Time从190,207 cycles降至106,999 cycles，Average Idle Time从1,196降至474 cycles（via Neutrino PTX插桩采集）；调整TILE_SIZE 32→16后shared memory bank conflict量从62.8万降至16.6万次，与cuBLAS量级相当。
- [[PTX]]是CUDA C++/PyTorch/TensorFlow JIT到GPU硬件的公共中间层，基于PTX可构建跨代GPU硬件的通用分析工具；nvcc生成PTX，ptxas将PTX汇编为SASS机器码执行。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针/weixin-img-008.jpg)

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针/weixin-img-020.jpg)

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针/weixin-img-021.jpg)

*Other images decorative — promo banners, WeChat follow widgets.*

## What this changes

Neutrino的PTX插桩路线提供了Nsight Compute之外的第三条路（前两条是browser tracing和Nsight），适合需要条件触发、个性化指标的微观性能调试，是eBPF思路在GPU侧的具体落地。

## Entities touched

[[Neutrino]], [[PTX]], [[Nsight Compute]], [[CUDA]]

## Topics touched

[[GPU Profiling]]

## Raw source

[mp.weixin.qq.com/s/FWeqR5ADU7RU7ZASkmtnTw](https://mp.weixin.qq.com/s/FWeqR5ADU7RU7ZASkmtnTw) — WeChat 公众号"阿里云开发者"，2025年9月8日. Read 2026-05-16.
