---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/YTKKW8HL-fu2pYOmffbI-g
tags: [training, observability, gpu, tooling]
---

# [2025-11-11] PyTorch显存可视化与Snapshot数据分析

## TL;DR

Practical guide to PyTorch 2.1's enhanced CUDA memory snapshot API and the PyTorch Profiler's memory timeline export. Covers three-step API usage, two visualization methods (pytorch.org/memory_viz or HTML conversion), and analysis of Active Memory Timeline, Allocator State History, and Active Cached Segment Timeline views.

## Key claims

- Three-step Snapshot API: `_record_memory_history(max_entries=100000)` → run workload → `_dump_snapshot(filename.pickle)` → `_record_memory_history(enabled=None)`.
- Visualize via drag-and-drop to https://pytorch.org/memory_viz or convert with `torch/cuda/_memory_viz.py trace_plot` to HTML.
- **Active Memory Timeline** shows per-tensor lifetime and call stack; the first iteration in a training loop uses less VRAM than subsequent ones because optimizer state is allocated after iteration 1.
- "Wave" patterns in the timeline are not tensor size changes — they are rendering artifacts caused by other tensors being created/released on the same display row.
- **Allocator State History** (`Allocator State History` view) shows CUDA segment→block lifecycle; `block.free` is a torch-allocator free, not a CUDA `cudaFree`; `cudaFree` only happens when an entire segment is released.
- Memory fragmentation occurs when a segment too small for the next allocation causes a new segment to be allocated, leaving the first segment partially unused.
- **PyTorch Profiler** memory timeline (`prof.export_memory_timeline`) offers labeled categories (parameter, optimizer_state, activation, gradient, autograd_detail) at lower granularity than raw Snapshot, but easier to read; requires warm-up iteration to avoid incorrect data.
- Snapshot overhead is high enough that it should be disabled in production; use during debug sessions only.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-11-12-pytorch显存可视化与snapshot数据分析/weixin-img-003.png)

![](../../raw/raindrop/mp.weixin.qq.com/2025-11-12-pytorch显存可视化与snapshot数据分析/weixin-img-006.png)

*Other images decorative — API call screenshots, block/segment diagrams, stack trace examples.*

## What this changes

Establishes a concrete three-view memory analysis workflow (Active Memory, Allocator State, Cached Segment) for diagnosing OOM and fragmentation in PyTorch training, with clear differentiation between torch-allocator and CUDA-level memory management.

## Entities touched

[[PyTorch]], [[PyTorch Profiler]]

## Topics touched

[[GPU Memory Management]]

## Raw source

[mp.weixin.qq.com/s/YTKKW8HL-fu2pYOmffbI-g](https://mp.weixin.qq.com/s/YTKKW8HL-fu2pYOmffbI-g) — InfraTech WeChat article; published 2025-11-11. Read 2026-05-15.
