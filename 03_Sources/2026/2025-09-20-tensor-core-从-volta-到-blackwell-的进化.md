---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/gvJ8i9KaPHG2vD3CFpSBrA
tags: [gpu, accelerator-design, low-precision, training, inference]
---

# [2025-09-09] Tensor Core 从 Volta 到 Blackwell 的进化

## TL;DR

系统梳理 NVIDIA [[Tensor Core]] 五代架构演进（Volta→Turing→Ampere→Hopper→[[Blackwell]]），沿三条主线追踪：计算密度、数据移动效率、精度控制机制，呈现从 8× 吞吐提升到 NVFP4 的完整进化逻辑。

## Key claims

- [[Tensor Core]] 前身：每次 FP16 HFMA 约 1.5 pJ 计算能耗，但控制逻辑开销高达 30 pJ（95% 能耗花在"如何算"），Volta 引入 HMMA 指令和专用 Tensor Core 将吞吐提升 8 倍以上。
- **Volta（2017）**：每 SM 8 个 Tensor Core，8 线程（4 quadpair）协同执行 8×8×4 MMA，支持 FP16 输入 + FP32 累加；矩阵存于寄存器。
- **Turing（2018）**：新增 INT8/INT4 支持（比 FP16 功耗更低），引入结构化稀疏化（硬件跳过零值计算，理论 2× 性能提升），针对推理能效优化。
- **Ampere（2020）**：引入异步数据复制（`cp.async`，DRAM→共享内存绕开寄存器），Warp 宽度 MMA（32 线程协同），每 SM 每周期 2048 FP16 FLOP（Volta 的 2 倍）；SM 共享内存扩至 164 KB。
- **Hopper（2022）**：CGA 线程块集群 + 分布式共享内存（DSMEM，跨 SM 直接访问），TMA 张量内存加速器（1D-5D 异步批量传输 + 多播），FP8（E4M3/E5M2）+ warpgroup 级异步 MMA（m64n256k16 达 8192 FP8 FLOP），Transformer Engine 动态精度切换；LLM 推理速度较 H100 前代提升 30 倍，H200 显存带宽 4.8 TB/s。
- **Blackwell（2024）**：256 KB TMEM（SM 级张量内存，操作数直接从共享内存/TMEM 读取，彻底摒弃寄存器存储矩阵），CTA 对机制（两 CTA 共享操作数，内存带宽需求降低 50%），MMA.2SM（跨两 SM 协作，m256n256k16），NVFP4（精度优于 MXFP4，存储减半），单线程异步 MMA 指令 `tcgen05.mma`。
- 五代算力密度汇总：Volta m8n8k4 1024 FP16 FLOP/周期 → Ampere m16n8k16 2048 FP16 FLOP → Hopper m64n256k16 8192 FP8 FLOP → Blackwell 2SM m256n256k16 32768 FP4 FLOP。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-20-tensor-core-从-volta-到-blackwell-的进化/weixin-img-003.png)
*Hopper CGA 分布式共享内存架构，展示线程块集群内 SM 间 DSMEM 直接访问。*

![](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-09-20-tensor-core-从-volta-到-blackwell-的进化/weixin-img-002.png)
*Ampere 16×8×16 混合精度浮点 MMA 的线程与数据布局示意。*

*Other images decorative — energy comparison diagrams, code flow charts.*

## What this changes

- 为理解 Blackwell 的 NVFP4 + TMEM 设计逻辑提供完整的代际演进视角，揭示每一代创新都针对前代遗留的具体瓶颈。

## Entities touched

[[Tensor Core]], [[Volta]], [[Ampere]], [[Hopper]], [[Blackwell]]

## Topics touched

[[Tensor Core Programming]]

## Raw source

[mp.weixin.qq.com/s/gvJ8i9KaPHG2vD3CFpSBrA](https://mp.weixin.qq.com/s/gvJ8i9KaPHG2vD3CFpSBrA) — WeChat 公众号"小叶投研"，2025-09-09，HTML 转 Markdown。Read 2026-05-15.
