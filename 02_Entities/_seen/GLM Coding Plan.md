---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# GLM Coding Plan

Zhipu AI subscription plan for GLM coding models with dedicated API endpoint for third-party tool integration

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- 智谱GLM Coding Plan（截至2025-12-06社区实践）：套餐专属API端点为`https://open.bigmodel.cn/api/coding/paas/v4`，非通用端点；在Cherry Studio等第三方客户端中新建Anthropic兼容提供商并填入该端点即可消费套餐额度；使用通用端点会按token计费而非套餐；智谱不完全按量计费，有模糊调用量限制，预计输入token够则放行，输出超额抹0不溢出。 — [[2025-12-06-我买了智谱的code套餐-然后我的apikey只能在claudecode这种编程]]
