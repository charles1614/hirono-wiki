---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/lJGkJ5fB62oKQdU8yhjAlA
tags: [training, observability, gpu]
---

# [2025-07-23] 如何利用PyTorch Memory Snapshot进行显存分析

## TL;DR

详解 [[PyTorch Profiler]] 的 memory snapshot 工具（`torch.cuda.memory._record_memory_history`）的工作机制，以混合精度（AMP）训练为例，逐步骤解读 segment 分配/复用/释放生命周期，并指导如何根据堆栈信息追溯显存分配代码路径。

## Key claims

- Memory snapshot 以 `.pkl` 格式记录 CUDA 显存 segment 的完整分配/释放历史，通过 `memory._record_memory_history(max_entries=100000)` 开启，`memory._dump_snapshot("tensor_profile.pkl")` 保存。
- PyTorch 显存管理分两层：Segment（向 CUDA driver 申请的连续显存块）和张量（Segment 内的分配单元）；`del` 张量引用计数归零触发 Python GC 释放张量，但 Segment 被 cache 保留供复用，需显式 `torch.cuda.empty_cache()` 才归还系统。
- AMP 混合精度训练中 forward 阶段在 `autocast()` 上下文内将权重临时转为 FP16 参与计算，FP32 主权重保留；backward 阶段 `GradScaler.scale(loss).backward()` 累积 FP16 梯度后 `scaler.step()` 将梯度还原 FP32 再更新权重。
- Memory snapshot 的堆栈信息可精确定位每次 `segment_alloc` 的调用来源（Python 文件/行号/函数），适用于追踪意外的显存增长或占用峰值来自何处。
- 推荐配合 HuggingFace 博客 [train_memory](https://huggingface.co/blog/train_memory) 一起使用以了解工具整体流程；本文侧重"如何解读记录内容"而非操作步骤。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[PyTorch Profiler]], [[PyTorch]]

## Topics touched

[[GPU Profiling]], [[GPU Memory Management]]

## Raw source

[mp.weixin.qq.com/s/lJGkJ5fB62oKQdU8yhjAlA](https://mp.weixin.qq.com/s/lJGkJ5fB62oKQdU8yhjAlA) — WeChat 公众号"大猿搬砖简记"，2025-07-23，HTML 转 Markdown。Read 2026-05-15.
