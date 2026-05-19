---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://newsletter.semianalysis.com/p/nvidia-tensor-core-evolution-from-volta-to-blackwell
tags: [gpu, accelerator-design, low-precision]
---

# [2026-01-15] NVIDIA Tensor Core Evolution: From Volta To Blackwell

## TL;DR

SemiAnalysis（Dylan Patel）深度技术文章，系统梳理从 Volta 到 Blackwell 五代 [[Tensor Core]] 架构演进：MMA 指令作用域（quadpair→warp→warpgroup→single-thread）、操作数内存位置（registers→SMEM→TMEM）、数据类型精度（FP16→FP8→FP4）及异步执行机制的演变。

## Key claims

- Volta（1st gen）：每 SM 8 个 Tensor Core，MMA 作用域为 8 线程的 quadpair，执行 8×8×4 矩阵乘，支持 FP16 输入/FP32 累加；HMMA 指令引入动机是摊销每条指令 ~30pJ 的发射开销（相比 HFMA 仅 1.5pJ，20× 开销差）。
- Ampere（3rd gen）：MMA 扩展为 warp 级（32 线程），`ldmatrix` 实现 warp 宽向量加载匹配 Tensor Core 布局，引入异步数据拷贝（`cp.async`）和 BF16 支持，每 SM 4 个 TC，512 FLOPs/cycle。
- Hopper（4th gen）：引入 warpgroup 级 MMA（`wgmma`，128 线程），操作数 B 直接从 SMEM 读取，支持 E4M3/E5M2 FP8 类型（累加路径实为 22-bit 定点，每 N_c 次需回 CUDA core 累加）；新增 TMA 硬件单元加速 bulk 异步拷贝，Thread Block Cluster 暴露 GPC 级并行。
- Blackwell（5th gen，`tcgen05.mma`）：完全移除 register 操作数，A 在 SMEM、D 在 TMEM；单线程语义发起 MMA，MMA.2SM 用 CTA pair 跨 2 SMs 共享 B 矩阵，实际上将每 SM 的 SMEM 需求减半；引入 256KB TMEM（与 register file 同大小）；支持 MXFP8/6/4 和 NVFP4，4:8 pair-wise 稀疏。
- Tensor Core 尺寸增长策略：矩阵乘法计算量是 O(n³)、数据移动是 O(n²)，算术强度 O(n) 线性增长，因此扩大 TC 尺寸比增加 TC 数量更高效——但大尺寸 TC 加剧 wave quantization，对小矩阵效率低。
- 共享内存每代几乎增加，但 register file 保持不变：TC 吞吐每代翻倍，全局内存延迟未下降反而上升，staging buffer（SMEM）必须随之扩大；Blackwell SMEM 未增是因为 tcgen05 MMA 跨 2SM，等效容量翻倍。
- 2:4 结构化稀疏在生产推理中几乎不被西方 AI 实验室使用（模型精度难以保持），仅少数中国 AI 实验室实验性应用；NVFP4 精度优于 MXFP4 的原因推测是更小的 block size、不同的 scaling factor 格式及两级量化方法。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/newsletter.semianalysis.com/2026-01-15-nvidia-tensor-core-evolution-from-volta-/substack-img-022.png)
![](https://hirono-wiki.litenext.digital/raindrop/newsletter.semianalysis.com/2026-01-15-nvidia-tensor-core-evolution-from-volta-/substack-img-023.png)
![](https://hirono-wiki.litenext.digital/raindrop/newsletter.semianalysis.com/2026-01-15-nvidia-tensor-core-evolution-from-volta-/substack-img-026.png)

*Other images decorative — Amdahl's law diagrams, PTX machine model, per-generation data layout visualizations (content inline-described in body).*

## Entities touched

[[Tensor Core]], [[CUDA]], [[Blackwell]], [[Hopper]], [[Ampere]], [[Volta]], [[CUTLASS]], [[FP8]], [[NVFP4]], [[WGMMA]], [[TMA]], [[BF16]]

## Topics touched

[[GPU Microarchitecture]], [[GPU Programming Models]], [[Tensor Core Programming]], [[Low-Precision Training]], [[Numerical Precision]]

## Raw source

[newsletter.semianalysis.com/p/nvidia-tensor-core-evolution-from-volta-to-blackwell](https://newsletter.semianalysis.com/p/nvidia-tensor-core-evolution-from-volta-to-blackwell) — SemiAnalysis, Dylan Patel, 2025年（bookmark日期2026-01-15），深度技术长文，29张图。Read 2026-05-15.
