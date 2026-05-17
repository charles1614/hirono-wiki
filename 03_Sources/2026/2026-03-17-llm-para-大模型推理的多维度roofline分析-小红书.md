---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: http://xhslink.com/o/3g25WZy7SvC
tags: [llm-inference, hardware, performance-modeling, roofline]
---

# [2026-03-17] LLM-Para：大模型推理的多维度Roofline分析

## TL;DR

Announcement post for LLM-Para, an open-source first-principles analytical modeling framework for LLM inference performance. Covers 13 operator types across 24 hardware platforms, extends the classical Roofline model to multi-tier memory (SRAM/DRAM/NAND Flash), energy, TCO, and CO₂ emissions, with an online interactive visualization platform.

## Key claims

- LLM-Para covers **13 operator types** — GQA, MoE routing, FlashAttention, RoPE, SwiGLU, DeepSeek MLA, etc. — versus 7 in LLM-Viewer, and returns results analytically (sub-second) vs. hours of cycle-accurate simulation in LLMCompass. — Source body
- The framework introduces **three-tier memory modeling** (SRAM/DRAM/NAND Flash) for analytical throughput prediction; under Flash-bottlenecked inference an 8B model achieves ~1 token/s, and INT4 quantization yields a 35× throughput improvement. — Source body
- Multi-objective design space exploration (DSE) searches a 5-dimensional hardware parameter space for **Pareto-optimal configurations** optimizing performance, energy efficiency, TCO, and CO₂ simultaneously. — Source body
- First framework to integrate classical Roofline, **Energy Roofline**, total cost of ownership, and CO₂e into a single LLM analysis pipeline. — Source body
- Benchmarks **24 hardware platforms** including H100, MI300X, Apple M3 Ultra, Snapdragon 8 Gen 3, Cambricon-LLM chiplet, and NAND-PIM near-memory compute architectures. — Source body
- Available as open-source at `github.com/dengls24/LLM-para` with full paper LaTeX source and charts; interactive demo at `llm-para.onrender.com`. — Source body

## Visual observations

![69b95b36000000002202af00_01.jpg](../../raw/raindrop/xhslink.com/2026-03-17-llm-para-大模型推理的多维度roofline分析-小红书/69b95b36000000002202af00_01.jpg)

## Entities touched

[[Roofline Model]]

## Topics touched

[[GPU Performance Modeling]], [[LLM Inference Systems]]

## Raw source

[xhslink.com/o/3g25WZy7SvC](http://xhslink.com/o/3g25WZy7SvC) — Xiaohongshu post by "Page Turner", 19 likes, 11 collects. Read 2026-05-15.
