---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Beluga

Alibaba Cloud CXL-based shared memory pool architecture for scalable LLM KVCache management

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Beluga（阿里云，arXiv:2511.20172）：利用CXL交换机（XConn XC50256，每台服务器两个CPU插槽各连一个PCIe 5.0×16适配器）构建可扩展共享内存池，最多连接16台服务器形成8TB内存池（1TB/s带宽）；GPU通过`cudaMemcpy` P2P直接访问，消除RDMA多级数据路径；相比MoonCake（RDMA），cache-hit场景TTFT降低89.6%、QPS提升7.35×，PD分离架构下QPS提升3.41×–9.47×。首个支持GPU通过CXL交换机直接访问大规模内存池的系统。 — [[2025-12-10-较mooncake首token延迟直降89-6-阿里云提出基于cxl的kv缓存管]]
