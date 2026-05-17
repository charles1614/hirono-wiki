---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: http://xhslink.com/o/59YTEXvV8UU
tags: [inference, benchmark, gpu]
---

# [2026-03-24] NVIDIA: VLA Inference Performance System Analysis

## TL;DR

Researcher at NVIDIA Research and NUS introduces VLA-Perf, an analytical performance model for Vision-Language-Action inference using the roofline model. The tool covers the combinatorial space of VLA algorithm × hardware × network choices and derives 15 performance insights about bottlenecks and compute intensity across deployment scenarios.

## Key claims

- VLA inference design space is large and unconverged: model architectures (autoregressive like OpenVLA, diffusion action experts like pi-0 and GR00T, world-action models like DreamZero), deployment locations (on-board GPU, edge server, cloud, hybrid), and synchronous/asynchronous inference tradeoffs all interact.
- [[VLA-Perf]] uses roofline analysis to model performance, bottlenecks, and compute intensity across algorithm × hardware × network combinations; paper and code are public (arXiv:2602.18397, github.com/nvlabs/vla-perf).
- No systematic paper previously analyzed [[VLA]] inference performance across this full design space; the field lacks algorithmic and systems convergence.
- Key deployment axis: on-board GPU vs edge server vs cloud vs hybrid — each implies different GPU choices and network environments (Ethernet/WiFi/5G).

## Visual observations

![69c20c55000000001f000789_04.jpg](../../raw/raindrop/xhslink.com/2026-03-24-nvidia-vla-inference性能系统分析-小红书/69c20c55000000001f000789_04.jpg)
![69c20c55000000001f000789_05.jpg](../../raw/raindrop/xhslink.com/2026-03-24-nvidia-vla-inference性能系统分析-小红书/69c20c55000000001f000789_05.jpg)

## Entities touched

[[VLA]], [[VLA-Perf]], [[NVIDIA]]

## Topics touched

[[Physical AI and Robotics]], [[LLM Inference Systems]], [[GPU Performance Modeling]]

## Raw source

[xhslink.com/o/59YTEXvV8UU](http://xhslink.com/o/59YTEXvV8UU) — Xiaohongshu post by WenqiJiang-NUS (NVIDIA Research / NUS), 2026-03-24; 175 likes, 250 collects. Read 2026-05-15.
