---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/v4cOA2cINHBQygUqsq3GVw
tags: [moe, parallelism, comm-overlap, gpu, training, inference]
---

# [2025-02-26] DeepSeek 开源系列之 DeepEP 介绍

## TL;DR

[[DeepEP]] 是 DeepSeek 开源的专为 [[MoE]] 和 [[Expert Parallelism]] 设计的通信库，提供高吞吐（training/prefill）和低时延（decoding）两类 All2All kernel，原生支持 FP8，并通过灵活的 SM 数量控制实现通信与计算 Overlap。

## Key claims

- DeepEP 提供节点内（NVLink+NVSwitch）和节点间（RDMA）两种通信路径，高吞吐 Kernel 用于训练/Prefill，低时延 Kernel 用于 Decoding，后者纯粹使用 RDMA 以最小化延迟。
- 在 H800（NVLink 单向实测 ~160 GB/s）+ CX7 400 Gb/s IB（约 50 GB/s）环境下，高吞吐 Kernel 的节点内外带宽均接近物理极限；低时延 Kernel 同样获得极高带宽和极低延迟。
- FP8 Dispatch 结合 BF16 Combine 可将节点间通信量减半；测试配置为 DeepSeek-V3/R1 预训练参数：每 Batch 4096 Token，隐藏层 7168，Top-4 组 Top-8 专家。
- 低时延 Kernel 通过 NVSHMEM IBGDA（InfiniBand GPUDirect Async）让 GPU SM 直接与 NIC 交互，绕过 CPU 代理线程；IBGDA 对小于 8 KiB 消息的时延降低约 50%。
- 高吞吐 Kernel 采用 warp specialization，默认 20 个 SM 划分为 10 个通信通道，每通道 2 个 Block（偶数发送，奇数接收），SM 数量可灵活配置。
- IB 自适应路由（AR）仅支持低时延 Kernel；高吞吐 Kernel 必须关闭 AR，否则可能导致死锁或数据损坏。
- DeepEP 使用 IB 虚拟通道（VL / SL）隔离不同 Workload 流量，防止 Head-of-Line 阻塞，延续 DeepSeek Fire-Flyer HPC 论文的设计。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-09-deepseek-开源系列之-deepep-介绍/weixin-img-025.png)
*图25：两个 Micro-Batch Overlap 方案——低时延 Kernel 借助 Receiving Hook 将 RDMA 传输异步执行在另一 Micro-Batch 计算期间，不占用 SM。*

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-10-09-deepseek-开源系列之-deepep-介绍/weixin-img-020.png)
*图20：H800 环境下高吞吐 Kernel 实测带宽，节点内外均接近物理极限。*

*Other images decorative — bandwidth comparison charts, code screenshots, all-to-all diagrams.*

## What this changes

- EP 通信不再是瓶颈制约：DeepEP 在 H800 集群上将 All2All 带宽利用率推至接近物理上限，使 MoE 专家并行的通信开销可被实际掩盖。
- 低时延 Kernel 的 Receiving Hook 接口使 Decoding 场景的通信不占用任何 SM，为更高 GPU 利用率打开空间。

## Entities touched

[[DeepEP]], [[DeepSeek]], [[Expert Parallelism]], [[MoE]], [[NVSHMEM]], [[NVLink]], [[NCCL]]

## Topics touched

[[MoE Training]], [[MoE Serving]], [[Communication-Computation Overlap]], [[Expert Parallelism]]

## Raw source

[mp.weixin.qq.com/s/v4cOA2cINHBQygUqsq3GVw](https://mp.weixin.qq.com/s/v4cOA2cINHBQygUqsq3GVw) — WeChat 公众号"AI闲谈"，2025-02-26，HTML 转 Markdown。Read 2026-05-15.
