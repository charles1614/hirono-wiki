---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/lE5TX3V7qdvYJIECrdsxAw
tags: [inference, kv-cache, paper]
---

# [2025-12-05] Beluga: 阿里云提出基于CXL的KVCache管理内存架构

## TL;DR

阿里云研究团队提出Beluga，利用CXL交换机构建GPU和CPU可直接访问的共享内存池，绕过RDMA复杂协议栈，在缓存命中场景下相比[[Mooncake]]（基于RDMA）将首Token延迟（TTFT）降低89.6%，[[vLLM]]吞吐量提升7.35倍。

## Key claims

- Beluga硬件拓扑：每台服务器配备两个CPU插槽（NUMA架构），每个插槽通过PCIe 5.0×16的PCIe/CXL适配器连接CXL交换机；交换机核心为两颗XConn XC50256芯片（各256条PCIe 5.0通道，2TB/s转发能力），最多连接16台服务器，形成总带宽1TB/s的8TB内存池。
- CXL相比RDMA的优势：GPU可通过`cudaMemcpy` P2P直接访问全局内存池，消除CPU驱动RDMA的多级数据路径；控制路径上数据传输内核可集成进GPU原生CUDA流，无跨组件同步开销；统一地址空间通过mmap()直接映射，简化内存管理。
- 性能评估（与Mooncake对比）：在cache-populate场景（命中率30%）TTFT降低12.4%、QPS提升21.5%；在cache-hit场景TTFT降低**89.6%**、QPS提升**7.35倍**。
- PD分离架构下：Beluga-KVCache相比MoonCake QPS提升3.41×至9.47×。
- KVCache块大小敏感性：MoonCake在16 token块时cache-hit TTFT从13.0秒增至76.8秒（超过重计算延迟）；Beluga可直接使用vLLM原生16 token块大小，无需批处理优化。
- 长上下文优势随输入增长更明显：从2K→4K→8K输入token，Beluga的性能优势持续扩大，因为KVCache读写时间在端到端延迟中占比更大。

## Visual observations

*No load-bearing images — all panels are experimental result charts (data captured in key claims above).*

## Entities touched

[[Mooncake]], [[vLLM]], [[Beluga]]

## Topics touched

[[KV Cache Management]], [[LLM Inference Systems]]

## Raw source

[mp.weixin.qq.com/s/lE5TX3V7qdvYJIECrdsxAw](https://mp.weixin.qq.com/s/lE5TX3V7qdvYJIECrdsxAw) — WeChat公众号"智猩猩AI"，2025年12月5日发布；论文 arXiv:2511.20172. Read 2026-05-15.
