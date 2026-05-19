---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/-K4QkPXY1DKPd6bq5rdrKA
tags: [observability, gpu]
---

# [2025-05-04] GPU火焰图的探索 — iaprof与AI Flame Graph工具介绍

## TL;DR

本文介绍了[[Brendan Gregg]]团队开源的英特尔平台AI火焰图生成工具[[iaprof]]，以及配套的时序分析工具[[Flamescope]]，展示了如何将CPU与GPU调用栈混合可视化用于性能分析。

## Key claims

- AI火焰图通过颜色区分设备：绿色为GPU/AI指令，浅绿色为源代码，红色（C）、黄色（C++）、橙色（内核）为CPU代码路径，灰色框标记CPU与AI/GPU边界。
- PyTorch专有适配以粉色标记PyTorch函数，支持多设备调用栈混合，便于跨层性能分析。
- [[Flamescope]]在普通火焰图（聚合抹去时序）基础上增加了热力图视图：横轴为时间（每列1秒，每小方格20ms），颜色深浅表示采样密度，支持点击区间生成对应火焰图，适合分析周期性扰动。
- Doom GPU Flame Graph将CPU热力图（左）与GPU热力图（右）并排展示，一眼可见全栈热点，并支持分别下钻渲染CPU和GPU火焰图。
- [[iaprof]]是[[Brendan Gregg]]在Intel构建的开源工具，可在Intel平台上采集AI火焰图；文章发布时已公开发布。

## Visual observations

![AI Flame Graph分层示意](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-06-09-gpu火焰图的探索-iaprof/weixin-img-001.png)

![Flamescope热力图界面](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-06-09-gpu火焰图的探索-iaprof/weixin-img-004.png)

![CPU+GPU并列热力图（Doom GPU Flame Graph）](https://hirono-wiki.litenext.digital/raindrop/mp.weixin.qq.com/2025-06-09-gpu火焰图的探索-iaprof/weixin-img-008.png)

*Other images decorative — duplicate diagrams, brand/tool screenshots with no additional data.*

## Entities touched

[[Brendan Gregg]], [[iaprof]], [[Flamescope]], [[PyTorch]]

## Topics touched

[[GPU Profiling]]

## Raw source

[mp.weixin.qq.com/s/-K4QkPXY1DKPd6bq5rdrKA](https://mp.weixin.qq.com/s/-K4QkPXY1DKPd6bq5rdrKA) — 程栩的性能优化笔记 公众号，2025-05-04. Read 2026-05-16.
