---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://apxml.com/zh/tools/vram-calculator
tags: [inference, gpu, tooling]
---

# [2025-07-24] VRAM 计算器：NVIDIA GPU 与 Apple Silicon (apxml.com)

## TL;DR

apxml.com 提供的中文 LLM 推理/微调显存与性能计算器，支持按模型架构、量化方式、KV 缓存精度、硬件配置、批量大小、序列长度和并发用户数估算 VRAM 占用和推理吞吐量。页面为交互式 SPA，内含详细的计算原理说明和常见误区澄清，包含截至 2026-04-03 的更新记录。

## Key claims

- 显存估算考虑架构参数（参数量、层数、隐藏维度、活跃专家数）、量化精度、序列长度和批量大小；结果为近似值，可能略高于实际（未考虑框架特定的内存节省优化）。
- 常见误解澄清：[[MoE]] 模型推理并不节省 VRAM——所有专家都必须驻留在内存中以实现快速切换；MoE 的优势在于减少计算量（激活参数更少），而非减少内存占用。若观察到 MoE 模型 VRAM 更小，通常是量化的效果而非 MoE 架构本身。
- TPS 公式基于观察基准测试，考虑模型参数（大小、架构）和量化对性能的影响，以及各 GPU 间相对性能差异的缩放因子。
- Ollama 默认使用 4-bit 量化（Q4_K_M）；计算器默认 FP16，故 Ollama 实际 VRAM 占用将低于默认计算结果——切换到 4-bit 量化选项可获得可比估算。
- 工具支持推理和微调两种模式；含训练成本估算（2026-02-03 加入）、并发用户排队效应修正（2025-12-08 修复）、Flash Attention TFTT 修复（2025-12-05）、梯度累积微调显存修复（2026-04-03）。

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[GPU]], [[MoE]]

## Topics touched

[[GPU Memory Management]], [[GPU Performance Modeling]], [[Quantization]]

## Raw source

[apxml.com/zh/tools/vram-calculator](https://apxml.com/zh/tools/vram-calculator) — 趋近智 (ApX Machine Learning) 交互计算器，2025-07-24，中文网页工具。Read 2026-05-15.
