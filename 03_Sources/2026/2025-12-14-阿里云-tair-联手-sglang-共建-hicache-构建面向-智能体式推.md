---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/2BbfcnxgR4aPN7_LKRYlNQ
tags: [inference, kv-cache, disaggregation, long-context]
---

# [2025-12-11] 阿里云Tair联手SGLang共建HiCache：面向智能体推理的分层KVCache

## TL;DR

阿里云Tair KVCache团队与[[SGLang]]社区、[[Mooncake]]团队合作，构建GPU显存-CPU内存-3FS分布式存储三层KVCache体系HiCache，在Novita AI生产环境实现缓存命中率由40%提升至80%、平均TTFT降低56%、推理QPS提升2倍。

## Key claims

- 智能体推理（Agentic Inference）带来三大KVCache挑战：状态膨胀（长上下文指数级增长）、跨轮次持久化缺失、多任务多智能体缓存孤立。
- Qwen2-7B模型在千级QPS、平均1K输入场景下，KVCache总量随缓存时长线性增长，从秒级GB量级膨胀至天级PB量级，远超GPU显存容量。
- SGLang已有RadixTree基数树实现跨请求前缀复用，HIRadixTree（HiCache）在此基础上扩展为三层存储：GPU显存→CPU内存→3FS分布式存储，原本40GB显存的GPU借助CPU内存可扩展至200GB+有效缓存容量。
- HiCache核心机制：热度感知LRU驱逐、异步Offload/Prefetch（请求入队时即触发`prefetch_from_storage`）、三种调度策略（Best_effort/Timeout/Wait_complete），以及Host→GPU逐层传输（`load_to_device_per_layer`）使计算与传输流水线重叠。
- 零拷贝传输通过布局变换实现：Host内存采用Page-first布局`[2, size, layer_num, ...]`，GPU显存采用Layer-first布局`[2, layer_num, size, ...]`，以一次布局转换换取传输路径上的零拷贝收益。
- [[3FS]]（DeepSeek开源分布式文件系统）作为HiCache持久化存储底座，180节点集群可达6.6 TiB/s读取带宽，结合RDMA网络与NVMe SSD，通过阿里云开源的3FS Operator实现K8s云原生部署。
- PD（Prefill/Decode）分离架构已与HiCache无缝集成，支持Prefill节点通过GDR（GPU Direct RDMA）高速通道实现KVCache跨实例复用，Decode节点通过`DecodeOffloadManager`轻量级组件异步卸载。
- Tair KVCache Manager提供统一全局KVCache管理，支持[[SGLang]]、[[vLLM]]、RTP-LLM、[[TensorRT-LLM]]等主流推理引擎接入，并提供仿真能力基于真实业务Trace计算命中率和算力节约量。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-12-14-阿里云-tair-联手-sglang-共建-hicache-构建面向-智能体式推/weixin-img-008.png)

*Other images decorative or system architecture diagrams captured in body text above.*

## What this changes

HiCache将KVCache从单机显存局部缓存扩展为跨节点分层存储基础设施，为智能体推理的超长上下文、高并发多任务场景提供可扩展路径；Page-first布局变换是零拷贝跨层传输的关键工程技巧。

## Entities touched

[[SGLang]], [[Mooncake]], [[3FS]], [[vLLM]], [[TensorRT-LLM]]

## Topics touched

[[KV Cache Management]], [[Inference Disaggregation]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/2BbfcnxgR4aPN7_LKRYlNQ](https://mp.weixin.qq.com/s/2BbfcnxgR4aPN7_LKRYlNQ) — WeChat公众号"阿里云开发者"，2025年12月11日发布. Read 2026-05-15.
