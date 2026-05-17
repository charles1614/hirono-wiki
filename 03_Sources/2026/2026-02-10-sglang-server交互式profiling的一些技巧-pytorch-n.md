---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/1992613341697438794
tags: [inference, observability]
---

# [2026-01-09] SGLang Server交互式Profiling的一些技巧(PyTorch & Nsys)

## TL;DR
实践指南：如何在 SGLang Server 运行期间交互式地控制 PyTorch Profiler 和 Nsight Systems (Nsys) 的启停，而无需重启服务或预设固定时间窗。适用于多 rank 负载均衡分析场景。

## Key claims
- [[SGLang]] Server 提供 `/start_profile` 和 `/stop_profile` HTTP API endpoints，支持运行时动态开启/停止 PyTorch Profiler，可指定 output_dir、start_step、num_steps、activities（CPU/GPU/MEM/RPD）、merge_profiles 等参数，生成 `{prefix}-{id}-TP-{tp}-DP-{dp}-PP-{pp}-EP-{ep}.trace.json.gz`。
- 多 rank profile 时，设置 `merge_profiles: true` 可自动合并各 rank 的 trace 为 `merged-{id}.trace.json.gz`，省去手动合并步骤。
- Nsys 交互式 profile：启动 sglang server 时加 `--start-later` 参数使 nsys 进入延迟模式，之后通过 `nsys start --session=<id>` 和 `nsys stop --session=<id>` 在任意时机控制 profile 窗口，server 不会被杀死，支持多次 start/stop。
- 多 rank trace 可视化技巧：在 Perfetto 或 [[Nsight Systems]] 中 pin（固定）关键行，便于在缩放整体视图时对比各 rank 的 kernel 执行时间。
- 背景动机：从 server 启动就开启 profiling 会产生难以处理的超大 trace 文件；交互式方式可精准对齐特定 workload pattern（如复现线上请求形态）。

## Visual observations
*No load-bearing images — single screenshot (zhihu-img-001.jpg) shows Nsight Systems UI with pinned rows; the technique is fully described in prose.*

## Entities touched
[[SGLang]], [[Nsight Systems]], [[PyTorch Profiler]]

## Topics touched
[[GPU Profiling]], [[Distributed-Serving Observability]]

## Raw source
[zhuanlan.zhihu.com/2026-02-10-sglang-server交互式profiling的一些技巧-pytorch-n](https://zhuanlan.zhihu.com/p/1992613341697438794) — Zhihu, author wxzhou, published 2026-01-09. Read 2026-05-15.
