---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 0
tier: seen
---

# AgentCube

Volcano sub-project for Serverless AI Agent orchestration on Kubernetes with MicroVM warm pools

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- AgentCube引入Warm Pool预热池机制（"Claim-and-Go"方式毫秒级分配MicroVM沙箱）、Session ID路由保障跨轮次会话连续性、基于`AgentRuntime`和`CodeInterpreter`两个核心CRD的声明式管理（可配置`warmPoolSize`热备沙箱数量）；南向通过RuntimeClass兼容Kata Containers/Firecracker/Kuasar，北向目标适配Dify/LangChain/CrewAI/LlamaIndex等框架。 — [[2026-01-11-重磅-volcano发布agentcube-构建ai-agent时代的云原生基础]]
