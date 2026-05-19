---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/1929264741248894425?share_code=cP3bo4m6NNEV&utm_psn=1931457858660205274
tags: [training, observability, gpu]
---

# [2025-07-18] 使用 NVIDIA Nsight Systems 分析 Ray 负载 (verl) 的性能

## TL;DR

NVIDIA 加速计算专家马立伟撰文，详述如何将 Nsight Systems 集成到基于 [[Ray]] 的强化学习框架 [[verl]] 中进行 GPU 性能分析。核心挑战：Ray 任务的实际计算进程由远端节点动态启动，标准 `nsys <app>` 命令只能捕获提交命令而非真正的计算任务；解决方案是通过 `ray.remote(runtime_env={"nsight": {...}})` 或实例化时 `.options(runtime_env=...)` 将 Nsight 参数注入 RayActor 进程。

## Key claims

- 标准 `nsys <application>` 在 Ray 框架下失效，根本原因是 application 只是提交命令，实际计算由 Ray 在远端节点动态调度启动。
- 解决方案：在 RayActor 定义或实例化时通过 `runtime_env={"nsight": {...}}` 注入 Nsight 参数，Ray 会将环境变量转换为 `nsys` 调用参数并用 `nsys` 启动该 Actor 对应进程。
- verl 的 single controller + distributed workers 架构需要分别跟踪 controller 进程（提供全局时间线，无 GPU 计算信息）和 worker 进程（含 GPU 活动详情）。
- 细粒度控制三个维度：(1) 目标训练步选择——通过 `torch.cuda.profiler.start()/stop()` 配合 capture-range 仅跟踪特定步；(2) 目标 rank 选择——仅对感兴趣的 GPU 进程开启跟踪；(3) 分立任务选择——对序列生成、优势计算、模型更新等子任务独立启停。
- verl 使用 NVTX 对 step/gen/reward/old_log_prob/ref/values/adv/update_critic/update_actor/testing 等步骤标注范围，通过 `marked_timer` 自动添加 NVTX 标记。
- 已知限制：Ray 会将跟踪数据库保存在 `/tmp/ray/session_*/logs/{profiler_name}`，路径不可修改（当前版本 Ray 的局限）；controller 进程位置不固定，verl 通过打印 hostname+PID 辅助定位。
- Nsight Systems 支持 multi-report view，可将 controller 和所有 workers 数据一次性导入，工具自动按时间排布。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248/zhihu-img-001.jpg)

*Other images decorative — author avatar photo.*

## What this changes

为基于 Ray 的 RL 训练框架（verl、OpenRLHF、AReal、ROLL、NeMo RL 等）提供了 [[Nsight Systems]] 集成的可复用设计模式，解决了 Ray 动态调度与传统 profiling 工具的兼容问题。

## Entities touched

[[Nsight Systems]], [[Ray]], [[verl]], [[NVIDIA]], [[PyTorch]]

## Topics touched

[[GPU Profiling]], [[RL Post-Training]], [[Observability]]

## Raw source

[zhuanlan.zhihu.com/p/1929264741248894425](https://zhuanlan.zhihu.com/p/1929264741248894425?share_code=cP3bo4m6NNEV&utm_psn=1931457858660205274) — NVIDIA 英伟达中国，马立伟，2025-07-18，知乎专栏文章。Read 2026-05-15.
