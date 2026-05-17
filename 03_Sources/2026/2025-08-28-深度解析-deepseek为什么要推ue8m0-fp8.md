---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/rcJ7JYfE6-L2IBpqdKBjMA
tags: [training, inference, low-precision, quantization, gpu]
---

# [2025-08-22] 深度解析：DeepSeek为什么要推UE8M0 FP8

## TL;DR

梳理从标准浮点格式（FP64→FP8）到 MXFP8（块级缩放 FP8）再到 DeepSeek-V3.1 采用的 UE8M0 FP8 的技术演进，解释 UE8M0（无符号 8 位指数、零尾数）设计哲学及其在 Blackwell 张量核心上的优化逻辑。

## Key claims

- [[MXFP8]]（OCP 2023 规范）为每 32 个连续元素分配独立的缩放因子（scale factor），使用 E8M0（8 位指数表示 2 的幂）；相比 FP8（整张量单一 FP32 缩放因子），动态范围约束更宽松，可全部使用 E4M3 格式，无需 E5M2 兼容梯度。
- Blackwell 张量核心要求 MXFP8 数据在约简维度上"连续"，转置 MXFP8 张量需要重新量化（非转置 FP8 只是数值重排），是 B200 训练中的主要开销来源：以典型 MoE 矩阵乘法为例，计算 1.16ms，量化+写回 0.44ms（占 38%），反向传播中转置-量化开销翻倍至 0.88ms（占 76%）。
- Cursor 团队采用"Warp 专精"技术（Warp0 主内存→共享内存，Warp1 加载缩放因子，Warp2 转移至 TMEM，Warp3 启动矩阵计算），配合 2-CTA 架构共享 B 矩阵，实测性能提升 15–20%；定制 MXFP8 量化内核内存带宽达 6.2 TB/s（现有开源工具约 4.5 TB/s）。
- DeepSeek UE8M0 FP8 设计：无符号（AI 计算 ReLU 激活负值稀少）、全指数（充分表示神经网络权重大动态范围）、零尾数（量化查找表替代）；在 DeepSeek-V3.1（671B 参数）中使梯度溢出率降低 99.7%，训练速度提升 3.15×。
- FP8 行业惯例：前向激活和权重用 E4M3（高精度），梯度用 E5M2（更大动态范围）；延迟缩放策略（使用历史 amax）避免多次扫描数据开销，但需额外存储 amax 历史。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-08-28-深度解析-deepseek为什么要推ue8m0-fp8/weixin-img-009.png)

![](../../raw/raindrop/mp.weixin.qq.com/2025-08-28-深度解析-deepseek为什么要推ue8m0-fp8/weixin-img-015.png)

*Other images decorative — FP format bit-layout diagrams, quantization flow charts captured in body text.*

## Entities touched

[[DeepSeek]], [[DeepSeek-V3]], [[FP8]], [[MXFP8]], [[Blackwell]], [[Cursor]]

## Topics touched

[[Low-Precision Training]], [[Quantization]], [[Numerical Precision]], [[MoE Training]]

## Raw source

[mp.weixin.qq.com/s/rcJ7JYfE6-L2IBpqdKBjMA](https://mp.weixin.qq.com/s/rcJ7JYfE6-L2IBpqdKBjMA) — WeChat公众号 / AIOT大数据, 2025-08-22. Read 2026-05-15.
