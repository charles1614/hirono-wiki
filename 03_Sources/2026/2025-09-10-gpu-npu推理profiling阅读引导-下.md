---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/Qv15u-dw3jWz3IFCaBnS9A
tags: [inference, observability, gpu, accelerator-design]
---

# [2025-09-10] GPU/NPU推理Profiling阅读引导（下）

## TL;DR

InfraTech系列文章下篇：介绍华为昇腾NPU配合Insight工具（类Nsight）的profiling阅读方法，以DeepSeek V3（MoE架构）为例展示Python/CANN/AscendHardware三层时序图分析，涵盖MLA+MoE层时序、集群通信滞后观测、stream event wait、AllReduce拆解优化和micro batch双流重叠度提升等场景。

## Key claims

- [[Huawei Ascend]] NPU的profiling工具Insight提供Python/CANN/AscendHardware/Communication/OverlapAnalysis/AI core Freq/HBM/LLC/QoS等多维时序图，细粒度高于通用browser tracing。
- 以DeepSeek V3（MoE+MLA架构）为例：不带堆栈的profiling中MoE与MLA层间存在大段to/iterm同步等待时序（区别于GPU场景），操作名称以"npu"开头；点击NPU stream可见event wait排队执行。
- 从上层Python下发到CANN层再到AscendHardware上实际通信操作存在可观测的时间滞后（可通过选中具体集群通信op量化）；点击stream算子横条可读取计算时间、输入/输出shape等元数据。
- 优化可视化：AllReduce拆解为ReduceScatter+AllGather并后移AllGather位置后，时序图可直接验证通信计算掩盖改善；micro batch双流运算使两个stream的MoE+MLA时序错位执行，OverlapAnalysis数据反映重叠度变化。
- 采集profiling存在时间膨胀效应（实际执行时间变长）；浏览器tracing快捷，Insight拆解更细，实践中按需选择；进一步分析NPU profiling中SDMA、AIV激活等指标需了解昇腾架构模块。
- 性能优化是持续迭代过程：粗粒度指标（训练samples/s，推理TPS）→ 采集profiling分析 → 优化瓶颈 → 重新观测；优先解决收益最大的瓶颈。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-10-gpu-npu推理profiling阅读引导-下/weixin-img-005.png)

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-10-gpu-npu推理profiling阅读引导-下/weixin-img-012.png)

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-10-gpu-npu推理profiling阅读引导-下/weixin-img-013.png)

*Other images decorative — logos, WeChat follow widgets.*

## Entities touched

[[Huawei Ascend]], [[DeepSeek-V3]], [[Nsight Systems]]

## Topics touched

[[GPU Profiling]]

## Raw source

[mp.weixin.qq.com/s/Qv15u-dw3jWz3IFCaBnS9A](https://mp.weixin.qq.com/s/Qv15u-dw3jWz3IFCaBnS9A) — WeChat 公众号"InfraTech"，2025年9月10日. Read 2026-05-16.
