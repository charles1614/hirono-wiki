---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/2vzh-6pfqOI7mg7yqqCqmA
tags: [observability, gpu, training, inference]
---

# [2025-09-18] Nsight Systems工具原理与GPU性能优化实战详解

## TL;DR

实战向 [[Nsight Systems]] 使用指南，涵盖 Profile 模式与 Launch 模式对比、关键参数配置、NVTX 标记技巧、多节点采集注意事项，重点讲解如何根据 Timeline 定位 Kernel 重叠度、CPU-GPU 交互瓶颈和显存带宽利用率。

## Key claims

- Nsight Systems（nsys）是跨平台工具（Windows/Linux/macOS），提供 CLI + GUI；生成 `.nsys-rep` 文件，在个人 PC 的 nsys GUI 加载做离线分析，不需要在训练服务器上有 GUI 环境。
- 两种采集模式：Profile 模式（命令行预指定 trace 类型和时长，自动停止，适合全流程；建议采集时间 ≤ 60s）；Launch 模式（先启动任务，另开终端手动 `nsys start/stop`，可多次采集，适合观察到运行状态后定向抓取）。
- 典型采集命令：`nsys profile --trace cuda,osrt,nvtx,cudnn,cublas --gpu-metrics-device=all --duration=60 --delay=120 --cuda-memory-usage true --output profile_log torchrun train.py`；多节点共享存储时输出文件名须含 hostname，否则被覆盖。
- NVTX（NVIDIA Tools Extension）可在代码中插入 marker/range 标注关键阶段（`@nvtx.annotate`、`with nvtx.annotate(...)`），在 Timeline 上可见，是定位 forward/backward/优化器各阶段的核心手段。
- nsys 需与当前 CUDA 环境发布时间接近安装（如 cuda 11.8 对应 2023 年 1 月版），版本不匹配有兼容性问题；训练镜像若无 nsys 组件需手动下载，Ubuntu 用 deb 包，RHEL 系列用 rpm 包。
- CPU 权限限制：非管理员采集 CPU 详细信息需执行 `echo 0 | sudo tee /proc/sys/kernel/perf_event_paranoid`；平台调度场景建议使用 launch 模式防止 pod 被杀导致文件丢失。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Nsight Systems]], [[PyTorch]]

## Topics touched

[[GPU Profiling]]

## Raw source

[mp.weixin.qq.com/s/2vzh-6pfqOI7mg7yqqCqmA](https://mp.weixin.qq.com/s/2vzh-6pfqOI7mg7yqqCqmA) — WeChat 公众号"白蘋渡口"，2025-09-18，HTML 转 Markdown。Read 2026-05-15.
