---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/RaizMsxbLY0xyBm1lYkUKA
tags: [inference, accelerator-design, paper]
---

# [2026-01-10] David Patterson：大语言模型推理硬件的挑战与研究方向

## TL;DR

David Patterson（Google DeepMind）与Xiaoyu Ma合著arXiv论文(2601.05047)的中文详解：LLM推理的主要瓶颈是内存和互连延迟而非算力，提出四个硬件研究方向——高带宽闪存(HBF)、近内存计算(PNM)、3D内存-逻辑堆叠、低延迟互连，批评当前"全掩模版芯片+高FLOPS+多HBM堆叠"的设计与解码推理需求不匹配。

## Key claims

- 自回归解码使LLM推理本质上受内存带宽/容量限制：2012-2022年NVIDIA GPU FP64算力增长80×，带宽仅增长17×，差距持续扩大；HBM容量/带宽单位成本2023-2025年均上涨1.35×，而DDR4同期降至0.54×/0.45×。
- 四大LLM新趋势加剧推理压力：MoE（扩大内存占用）、推理型模型（长思考token序列）、多模态（更大数据类型）、长上下文（KV Cache爆炸）；扩散模型为例外，仅增加计算需求。
- 预填充/解码解耦（[[Inference Disaggregation]]）是核心软件优化路径之一，已有综述(arXiv:2404.14294)。
- 研究方向①高带宽闪存(HBF)：类HBM堆叠闪存，10×内存容量 + 接近HBM带宽；优势是持续容量扩展（闪存每3年翻倍vs DRAM停滞）；限制是写入耐久性差（不适合KV Cache）和基于页的高延迟读取（微秒vs DRAM纳秒）。
- 研究方向②近内存计算(PNM) vs. 内存内计算(PIM)：PNM分片粒度可达16-32 GB（PIM仅32-64 MB），更易软件适配；PIM在数据中心LLM场景劣势明显，但移动设备可能可行。
- 研究方向③3D内存-逻辑堆叠：通过硅通孔(TSVs)在低功耗下实现高带宽；基于HBM基片方案可降低2-3×功耗；主要挑战是散热（表面积小）和内存-逻辑耦合标准化。
- 研究方向④低延迟互连：LLM推理（小批、多跳）对延迟比带宽更敏感；高连通性拓扑（蜻蜓/高维环面）、网络内计算（支持全归约）、本地备用节点均可降低端到端延迟。
- 结论：现有"大芯片+高FLOPS+多HBM"设计哲学适合训练，不适合解码推理；建议新型性能指标聚焦数据中心容量约束、功耗和碳足迹，而非单纯FLOPS。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2026-01-10-david-patterson-大语言模型推理硬件的挑战与研究方向/weixin-img-002.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-10-david-patterson-大语言模型推理硬件的挑战与研究方向/weixin-img-010.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-10-david-patterson-大语言模型推理硬件的挑战与研究方向/weixin-img-011.png)

*Other images decorative — figures referenced inline with full captions in body text.*

## Entities touched

[[NVIDIA]], [[A100]], [[H100]], [[MoE]]

## Topics touched

[[LLM Inference Systems]], [[Inference-Optimized Accelerators]], [[Inference Disaggregation]], [[GPU Memory Management]], [[MoE Serving]]

## Raw source

[mp.weixin.qq.com/s/RaizMsxbLY0xyBm1lYkUKA](https://mp.weixin.qq.com/s/RaizMsxbLY0xyBm1lYkUKA) — 公众号 NeuralTalk，2026-01-10；原论文 arXiv:2601.05047 by David Patterson & Xiaoyu Ma. Read 2026-05-15.
