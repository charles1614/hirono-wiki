---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# AttentionStore

Baidu Baige's production KV-cache scheduling, tiered-storage, and transfer-acceleration engine that achieves 6.2× TTFT reduction on DeepSeek R1 671B at 64K context.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- 百度混合云将 Attention Store（分布式 KV Cache 引擎）部署于国产芯生产环境：利用 SSD 和内存补充显存容量，实现显存→内存→SSD 三级缓存；通过 Cache-Aware 调度使 Prefix Cache 命中率提升 30–50%，万卡集群典型推理场景 TTFT 降低 37%。 — [[2025-09-16-超大规模-ai-基础设施建设实践-极致释放算力效能]]
