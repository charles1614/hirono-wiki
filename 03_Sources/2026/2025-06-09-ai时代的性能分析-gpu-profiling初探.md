---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/pvWEeOb-WnMDqQPsWJ1xxA
tags: [observability, gpu]
---

# [2025-03-18] AI时代的性能分析：GPU Profiling初探

## TL;DR

本文为GPU Profiling工具入门综述，介绍NVIDIA官方Nsight Systems、PyTorch Profiler两种采样工具，以及chrome://tracing、TensorBoard、AI火焰图三种可视化方式，以DeepSeek开源profiling数据为演示案例。

## Key claims

- [[Nsight Systems]]由GUI系统和`nsys`命令行工具组成，支持采样后输出数据给GUI展示，也可通过GUI直接发起任务。
- [[PyTorch Profiler]]通过在代码中显式开启Profiling采样，输出GPU时间占比最多的函数列表及JSON格式追踪数据。
- `chrome://tracing`可导入PyTorch Profiler生成的JSON，在时间轴上展示各模块调用关系；TensorBoard提供同类功能并支持多维度数据选择（`http://localhost:6006/#pytorch_profiler`）。
- AI火焰图（[[Brendan Gregg]]提出）通过颜色混合CPU和GPU调用栈：绿色为AI/GPU指令，红/黄/橙为CPU代码路径；[[PyTorch]]专有适配以粉色标记PyTorch函数。
- 本文的Python示例代码已开源于 github.com/AshinZ/perf-workshop/tree/main/introduce-to-gpu-profiling。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

从CPU profiling思路迁移到GPU profiling的入门路线：nsys采样 → JSON导出 → chrome::tracing/TensorBoard可视化 → AI火焰图做跨层分析。

## Entities touched

[[Nsight Systems]], [[PyTorch Profiler]], [[Brendan Gregg]], [[PyTorch]]

## Topics touched

[[GPU Profiling]]

## Raw source

[mp.weixin.qq.com/s/pvWEeOb-WnMDqQPsWJ1xxA](https://mp.weixin.qq.com/s/pvWEeOb-WnMDqQPsWJ1xxA) — 程栩的性能优化笔记 公众号，2025-03-18. Read 2026-05-16.
