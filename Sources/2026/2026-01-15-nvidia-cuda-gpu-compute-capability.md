---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://developer.nvidia.com/cuda/gpus
tags: [gpu, accelerator-design]
---

# [2026-01-15] NVIDIA CUDA GPU Compute Capability

## TL;DR

NVIDIA 官方 Compute Capability（CC）查询表，列出从 CC 7.5（Turing）到 CC 12.1（Blackwell/GB10）的所有现役数据中心、工作站/消费级及 Jetson GPU 的 CC 版本。

## Key claims

- Blackwell 架构数据中心 GPU（[[GB200]]、B200）为 CC 10.0；[[GB300]]/B300 为 CC 10.3；RTX PRO 6000 Blackwell Server Edition 为 CC 12.0。
- Hopper 架构（[[H100]]、H200、GH200）均为 CC 9.0。
- Ada Lovelace 数据中心（L4、L40、L40S）为 CC 8.9；Ampere 数据中心（[[A100]]、A30）为 CC 8.0。
- 消费级 Blackwell（GeForce RTX 5090–5050）及 RTX PRO Blackwell 工作站系列均为 CC 12.0；NVIDIA GB10 DGX Spark 为 CC 12.1。
- CC 定义了 GPU 硬件特性和支持的指令集；[[CUDA]] 程序按 CC 编译，低 CC 不支持高 CC 引入的新指令（如 Blackwell 的 `tcgen05.mma`）。

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[CUDA]], [[H100]], [[A100]], [[GB200]], [[Blackwell]], [[Hopper]]

## Topics touched

[[GPU Microarchitecture]], [[GPU Programming Models]]

## Raw source

[developer.nvidia.com/cuda/gpus](https://developer.nvidia.com/cuda/gpus) — NVIDIA 官方 CC 查询页，参考数据，2026-01-15 快照。Read 2026-05-15.
