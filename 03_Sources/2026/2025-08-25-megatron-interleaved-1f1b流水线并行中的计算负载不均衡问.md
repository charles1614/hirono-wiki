---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/694556728
tags: [training, parallelism, comm-overlap, microbenchmark]
---

# [2024-06-26] Megatron Interleaved 1F1B流水线并行中的计算负载不均衡问题研究

## TL;DR

深入分析 [[Megatron Interleaved 1F1B]] 流水线并行（VP>1）能够 overlap p2p 通信的原理，以及最后一个流水线 Stage 的额外 Logit & Loss 计算如何破坏这一 overlap，引入周期性通信延迟，基于 LLaMA 7B（16 层）+ 4× A100 + PP=4/VP=2 实验。

## Key claims

- Interleaved 1F1B 稳态阶段每迭代执行四步：Forward → send_forward_recv_forward → Backward → send_backward_recv_backward；第2步通信与第3步 Backward 无依赖（可并行），前一轮第4步通信与下一轮第1步 Forward 无依赖（可并行）——这是 overlap 的理论基础。
- Native 1F1B 稳态阶段的 send_forward_recv_backward 直接用于下一步 backward_step，send_backward_recv_forward 直接用于下一步 forward_step，存在强依赖，无法 overlap。
- 计算负载不均衡（最后一个流水线 Stage 含额外 Logit & Loss 计算）破坏 overlap 条件：发起通信时对端数据尚未就绪，触发等待；Mini Batch 1–4 的额外计算累积推迟了 GPU 3 Chunk 0 处理 Mini Batch 5 的时间点，引发 GPU 0 出现第二个较大 bubble。
- Profile 实验（PP=4, VP=2, GBS=8）显示 GPU 0/1/2 出现等待 GPU 3 Chunk 1 反向传播的通信延迟气泡；扩大 GBS 至 16/32 后，延迟在稳态阶段呈周期性出现。
- 作者指出：随着高端 GPU 禁售，国内可能更多使用推理 GPU/阉割版/国产 GPU，显存和通信带宽受限，更小规模 LLM 将更频繁使用流水线并行，计算负载不均衡问题将更凸显。

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-08-25-megatron-interleaved-1f1b流水线并行中的计算负载不均衡问/zhihu-img-001.jpg)

![](https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-08-25-megatron-interleaved-1f1b流水线并行中的计算负载不均衡问/zhihu-img-008.jpg)

*Other images decorative — GPU profile timelines redundant with analysis in body.*

## Entities touched

[[Megatron Interleaved 1F1B]], [[Megatron-LM]], [[A100]]

## Topics touched

[[Pipeline Parallelism]], [[Communication-Computation Overlap]], [[LLM Training Systems]], [[Parallelism Strategies]]

## Raw source

[zhuanlan.zhihu.com/p/694556728](https://zhuanlan.zhihu.com/p/694556728) — 知乎 / Anonymous, 2024-06-26. Read 2026-05-15.
