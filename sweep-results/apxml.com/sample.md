# LLM 推理: 显存与性能计算器 (apxml VRAM Calculator)

> 原文链接: https://apxml.com/zh/tools/vram-calculator
> 工具元信息: 基于浏览器的 LLM 显存与性能交互式计算器 (NVIDIA GPU 与 Apple Silicon) · Cloudflare-protected, 需要 ~15s 的 JS 挑战通过

---

## 计算原理

显存使用量是根据考虑架构 (参数、层、隐藏维度、活跃专家等) 、量化、序列长度和批次大小的模型进行估算的。性能估算考虑了模型/硬件分析和基准测试, 尽管基准测试的准确性有所不同。结果均为近似值。

[了解更多关于显存需求如何计算的信息 →](https://apxml.com/posts/how-to-calculate-vram-requirements-for-an-llm)

## 工具输入维度

- **模式**: 推理 / 微调 (二选一)
- **量化精度**: 模型权重 (推理时使用低精度可减少显存但可能影响质量) + KV缓存量化 (低精度可减少显存, 尤其适用于长序列)
- **硬件**: GPU 选择 (NVIDIA / Apple Silicon) 或自定义显存; GPU 数量 (并行推理)
- **输入参数**:
  - 批量大小 (1, 8, 16, 32 — 每步同时处理的输入数, 影响吞吐量和延迟)
  - 序列长度 (1k, 2k, 4k, 8k, 16k, 32k — 每个输入的最大 token 数, 影响 KV 缓存和激活)
  - 并发用户数 (1, 4, 8, 16, 32 — 同时进行推理的用户数, 影响内存和每用户性能)
- **可选**: 启用卸载到 CPU/RAM 或 NVMe

## 输出维度

- **显存**: 总占用 / 共有 / 利用率 (e.g. 7.52 GB 共 12 GB 显存, 62.7%)
- **性能**: 生成速度 (tok/sec), 每 token 延迟 (ms), 首个令牌时间 (TTFT)
- **总吞吐量**, **性能模式** (优化目标)
- **内存分配明细**: 基础模型权重 / 激活 / KV 缓存 / 框架开销 — 各占总量的百分比
- **功耗** (W) + **每小时成本** ($) + **CO₂ 排放** (kg/year)
- **推理模拟**: 输入序列下首令牌时间的可视化播放

## 常见问题

### 这个计算器有多准确？

本计算器提供理论估算, 旨在让您对显存需求有一个大致的了解。由于许多变量 (例如内存带宽、CUDA核心实现、驱动程序开销、微小的模型架构差异) 过于复杂, 无法纳入本计算器, 因此它无法提供精确到 GB 的精度。

计算结果也可能略高于实际使用情况, 因为它们没有考虑某些特定于框架的内存节省优化。然而, 对于硬件规划和容量估算来说, 它通常足够准确。

### TPS (每秒令牌数) 是如何计算的？

TPS 公式基于各种来源的观察基准测试结果。它考虑了模型参数 (如大小和架构) 和量化如何影响性能。该公式还包括缩放因子, 以解释各种 GPU 之间的相对性能差异。虽然不是一种完美的方法, 但它是在不为每种配置运行实际基准测试的情况下估算性能的更实用的方法之一。

### 为什么 MoE 模型会使用这么多显存？

这是一个常见的误解, 认为混合专家 (MoE) 模型在推理过程中使用较少的显存。虽然对于任何给定的令牌只有一部分 "专家" 是活跃的, 但**所有专家都必须驻留在内存 (VRAM) 中**以实现快速切换并保持性能。MoE 的主要资源优势在于减少计算需求 (尤其是在训练期间) , 而不是内存使用量。然而, MoE 模型在相同内存占用的情况下确实提供了更快的生成速度, 因为它们在每个令牌上激活的参数更少。

参考文献:
- [Mixture of Lookup Experts](https://arxiv.org/pdf/2503.15798) — Shibo Jie, Yehui Tang, Kai Han, et al. (2025)
- [Towards Efficient Mixture of Experts: A Holistic Study of Compression Techniques](https://arxiv.org/pdf/2406.02500) — Shwai He, Daize Dong, Liang Ding, Ang Li (2024)
- [Joint MoE Scaling Laws: Mixture of Experts Can Be Memory Efficient](https://arxiv.org/pdf/2502.05172) — Jan Ludziejewski, Maciej Pióro, Jakub Krajewski, et al. (2025) *(注: 本文所述的内存效率是通过特定技术和优化实现的, 而非源自 MoE 架构本身。)*

### 为什么这里的显存要求比我在 Ollama 上运行模型时要高？

Ollama 默认情况下通常对许多模型使用 4 位量化 (Q4_K_M) , 以使其能够在消费级硬件上运行。本计算器默认为 **FP16**, 这是性能基准测试和云部署的通用标准, 导致更高的显存要求。您可以在 "量化" 下拉菜单中选择 4 位量化以查看可比较的估算值。

## 最近更新

- **2026 年 4 月 3 日** — 修复微调时关于梯度累积的显存计算问题
- **2026 年 2 月 18 日** — 改进微调的批量大小扩展
- **2026 年 2 月 3 日** — 添加训练成本估算计算
- **2025 年 12 月 8 日** — 修复每用户速度计算, 以正确考虑当并发用户超过批处理大小时的排队情况
- **2025 年 12 月 5 日** — 修复 TFTT 计算错误, 其中 Flash Attention 优化应用不正确; 修复 MoE 模型的 TPS 计算以考虑活跃专家

## 相关资源

- [本地大模型入门免费课程](https://apxml.com/courses/getting-started-local-llms) — 趋近智 (ApX Machine Learning) 提供的免费课程, 从零开始本地部署 LLM
- [显存需求计算原理博客](https://apxml.com/posts/how-to-calculate-vram-requirements-for-an-llm)
