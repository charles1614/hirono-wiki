---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/k2mJxZmrw130kaMLig-hgg
tags: [training, gpu, low-precision]
---

# [2025-05-11] Nvidia Blackwell新特性之UMMA：张量内存与tcgen05.mma详解

## TL;DR

本文详解[[Blackwell]] GPU引入的UMMA（Universal MMA，即`tcgen05.mma`）指令与专用[[Tensor Memory]]（TMEM），阐述与Hopper WGMMA的关键差异，并通过第一个CuTe Blackwell GEMM示例说明[[CUTLASS]]中的UMMA接口与TMEM管理模式。

## Key claims

- [[UMMA]]替代Hopper的`wgmma.mma_async`，Hopper的WGMMA指令在Blackwell上已弃用；UMMA支持更低精度（FP4、FP6）、内置块缩放（block scaling）、单线程启动（仅一个线程发起MMA），以及CTA对（CTA-pair）跨两个SM协同计算。
- [[Tensor Memory]]（TMEM）是每个SM专有的256KB片上存储，二维结构：512列×128行（通道）×32位；用于UMMA的累加器（Accumulator必须在TMEM）和可选的操作数A（可在TMEM或SMEM），操作数B必须在SMEM。
- TMEM完全消除MMA的寄存器压力：累加器不再占用通用寄存器；单线程启动+无寄存器设计使MMA与CTA主执行流程深度解耦；结合TMA，GEMM主循环中CTA直接负责的任务仅剩预处理和后处理。
- 最大UMMA原子操作大小为128×256×16，是WGMMA最大原子的2倍；累加器恰好占用TMEM一半（256列），支持多原子流水而不牺牲性能。
- TMEM通过`tcgen05.alloc`分配（最少32列，必须是2的幂次），`tcgen05.dealloc`显式释放；同一warp执行分配与释放；地址16位行+16位列，步长65536（=1<<16）体现在CuTe布局中。
- `tcgen05.ld`（`tcgen05.ld.sync.aligned.32x32b.x1.b32`）将TMEM数据加载到寄存器，warp级同步操作；每个线程warp只能访问128通道中的32个通道；`make_tmem_copy`硬编码4个warp（1个warpgroup）参与尾声（epilogue）阶段。
- ThrID布局在UMMA中重定义为"CTA Peer布局"（大小为1或2），而非传统线程布局；CuTe切片使用CTA peer ID而非threadIdx。
- 消费级Blackwell（计算能力12.0，如5090d）缺少Tensor Memory，UMMA只在数据中心Blackwell（计算能力10.0）上可用。
- nvcc新增`--g-tensor-memory-access-check`运行时标志，检测未初始化或越界TMEM访问。

## Visual observations

![TMEM二维地址布局（PTX文档）](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-06-09-一起聊聊nvidia-blackwell-新特性之umma/weixin-img-002.png)

![tcgen05.ld 32x32b数据加载模式图](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-06-09-一起聊聊nvidia-blackwell-新特性之umma/weixin-img-003.png)

*Other images decorative — decorative banner and TMEM warp access pattern diagrams redundant with text description.*

## What this changes

UMMA+TMEM使MMA操作彻底与寄存器解耦，延续了Volta（Tensor Core分离算术）→ Ampere（异步拷贝）→ Hopper（TMA单线程+WGMMA异步）的专用硬件演进路线，寄存器资源可专用于调度与融合尾声。

## Entities touched

[[UMMA]], [[Tensor Memory]], [[Blackwell]], [[CUTLASS]], [[CUDA]]

## Topics touched

[[GPU Microarchitecture]], [[GPU Programming Models]]

## Raw source

[mp.weixin.qq.com/s/k2mJxZmrw130kaMLig-hgg](https://mp.weixin.qq.com/s/k2mJxZmrw130kaMLig-hgg) — 机智流 公众号，2025-05-11. 译自 research.colfax-intl.com CUTLASS tutorial。Read 2026-05-16.
