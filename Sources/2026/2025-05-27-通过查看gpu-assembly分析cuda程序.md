---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/llFuPxHPqfuzZdrt2h6V1Q
tags: [gpu, microbenchmark]
---

# [2025-04-21] 通过查看GPU Assembly分析CUDA程序

## TL;DR

通过比对 `vectorCopy` 和 `vectorCopyVectorized` 两个CUDA kernel的SASS汇编代码，解释向量化load/store（`LDG.E.128`/`STG.E.128` vs `LDG.E`/`STG.E`）为何显著提升内存受限程序性能。

## Key claims

- 非向量化版本每线程使用 `LDG.E`/`STG.E` 操作32位（4字节），向量化版本（`float4`）使用 `LDG.E.128`/`STG.E.128` 操作128位（16字节），指令数相同但每条指令传输数据量为4倍。
- 对于 `N = 1<<30`、`threadsPerBlock = 1<<10` 的配置，非向量化需启动1,048,576个block，向量化仅需262,144个block（减少75%），从而大幅降低调度开销和总指令数。
- 向量化版本多出一条 `USHF.R.S32.HI` 位移指令用于计算 `N/4`，可通过调用时传入 `N/4` 消除该指令，但影响微小。
- [[CUDA]] SASS代码可通过Godbolt（指定 `-arch sm_90 -use_fast_math -O3`）或NVIDIA NCU工具获取，是分析内存受限kernel瓶颈的有效手段。
- 文章指出选择正确的GPU架构（如 `sm_90` 对应H100）对生成准确的SASS代码至关重要。

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[CUDA]]

## Topics touched

[[GPU Profiling]], [[GPU Programming Models]]

## Raw source

[mp.weixin.qq.com/s/llFuPxHPqfuzZdrt2h6V1Q](https://mp.weixin.qq.com/s/llFuPxHPqfuzZdrt2h6V1Q) — 微信公众号"GiantPandaLLM"，转译自Simon V博客，2025-04-21. Read 2026-05-16.
