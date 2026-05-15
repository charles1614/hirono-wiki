---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/qCLmsJVr1IXLYsYVJEdnmg
tags: [inference, tooling, observability, gpu]
---

# [2025-07-26] NCCL InfiniBand 测试验证工具说明文档

## TL;DR

Documentation for `nccl_ib_test.sh`, a shell script tool for validating [[NCCL]] performance over InfiniBand/RoCE networks: it auto-detects IB vs. RoCE, configures NCCL environment variables, runs distributed AllReduce tests across GPUs, and generates a detailed performance report.

## Key claims

- Four-mode CLI: `env` (set NCCL vars), `test` (run distributed AllReduce), `report` (generate report), `all` (full pipeline, default).
- System checks cover Python3, PyTorch, CUDA, NCCL, NVIDIA GPU, IB device status, Link Layer type, and network topology.
- Supports both native IB and RoCE environments with automatic detection and GPUDirect RDMA enablement.
- Ring AllReduce algorithm complexity: theoretical transfer = 2 × (N-1)/N × data_size; bandwidth utilization approaches 100% for large messages.
- Report includes latency, data throughput, theoretical transfer, and diagnostics (errors/warnings count).
- Software requirements: Linux, Python 3.6+, PyTorch with CUDA, NCCL library, `ibstat` / `ibv_devinfo` / `perfquery` InfiniBand tools.
- Source script at ForceInjection/AI-fundermentals repo: `ops/IB/nccl_test/nccl_ib_test.sh`.

## Visual observations

*No load-bearing images — source has no images.*

## What this changes

Provides an operator-ready diagnostic runbook for NCCL IB validation; useful as a first-check tool when diagnosing inter-node communication issues in multi-GPU inference or training clusters.

## Entities touched

[[NCCL]], [[CUDA]]

## Topics touched

[[GPU Cluster Networking]], [[Observability]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/qCLmsJVr1IXLYsYVJEdnmg](https://mp.weixin.qq.com/s/qCLmsJVr1IXLYsYVJEdnmg) — WeChat public article by AI 原力注入, published 2025-07-26. Read 2026-05-15.
