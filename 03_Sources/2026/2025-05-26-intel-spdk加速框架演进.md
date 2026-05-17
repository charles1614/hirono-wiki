---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/KWqGXk5vr6z0ZkuVt9LuMg
tags: [inference, data-loading]
---

# [2025-05-16] Intel：SPDK加速框架演进

## TL;DR

Overview of [[SPDK]]'s acceleration framework evolution, focusing on the new chained-operations API and buffer management optimizations shipped in SPDK v24.05, validated on Intel IPU (Infrastructure Processing Unit) with LCE (Link Crypto Engine) hardware. Covers the problem of serial single-operation accelerator calls and how chaining collapses multi-step pipelines (compress + encrypt + CRC) into a single hardware request.

## Key claims

- [[SPDK]] is a BSD-licensed user-space storage software collection targeting high-performance NVMe/NVMe-oF, supporting vhost (SCSI/blk), vfio-user, hardware accelerators (DSA, IOAT, QAT), and integrations with Ceph, Kubernetes, RocksDB.
- Prior framework limitation: multi-step IO operations (DMA + encrypt + CRC) required separate accelerator calls per step, causing multiple buffer roundtrips and memory bandwidth pressure; some operations were executed outside the framework to avoid overhead.
- New chained API (`spdk_accel_append_encrypt()`, `spdk_accel_append_copy()`, `spdk_accel_sequence_finish()`) lets callers build an operation chain submitted as a single hardware request — matching LCE's native chained-operation capability.
- Deferred buffer allocation (via "fake buffer" placeholder): critical for read paths — avoids pre-allocating fixed-size buffers before actual data size is known.
- Faster buffer free: write buffers released as soon as data is submitted to network/hardware, without waiting for end-to-end completion confirmation — reduces memory footprint.
- Both optimizations are in open-source SPDK core — vendor-specific code only handles hardware programming, not buffer management logic.
- Delivered in SPDK v24.05; future work targets per-layer performance tuning across the full storage stack.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## What this changes

Documents a practical pattern for storage pipelines: collapse multi-step accelerator calls into chained sequences to reduce memory bandwidth and latency; applicable to any IPU/DPU-backed NVMe-oF deployment.

## Entities touched

[[SPDK]]

## Raw source

[mp.weixin.qq.com/s/KWqGXk5vr6z0ZkuVt9LuMg](https://mp.weixin.qq.com/s/KWqGXk5vr6z0ZkuVt9LuMg) — WeChat public account "王知鱼", published 2025-05-16. Slides from SNIA SDC 2024 presentation by Intel senior engineer Deb Chatterjee. Read 2026-05-16.
