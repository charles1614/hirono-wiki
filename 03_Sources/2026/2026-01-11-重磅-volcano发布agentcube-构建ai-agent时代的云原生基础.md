---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/AeGy0xq-Da1sYTpY3ssMaQ
tags: [inference, scheduling, tooling, announcement]
---

# [2026-01-09] 重磅！Volcano发布AgentCube，构建AI Agent时代的云原生基础设施

## TL;DR

Volcano社区宣布新子项目AgentCube：在[[Kubernetes]]之上构建面向AI Agent工作负载的Serverless编排层，通过Warm Pool预热、毫秒级调度、会话状态管理、MicroVM强隔离四大核心机制解决原生K8s在高并发Agent场景中的"粒度错配"问题。

## Key claims

- 原生Kubernetes在Agent场景存在四类缺位：Pod冷启动秒级延迟 vs. Agent毫秒级响应要求、CPU/Memory在90%等待时间内闲置无法复用、Pod重启导致上下文（Memory）丢失、不可信代码执行需强隔离沙箱。
- AgentCube核心架构：控制面（Workload Manager）+ 数据面（AgentCube Router）+ 调度层（Volcano Agent Scheduler）三层分离；Router基于`x-agentcube-session-id`做智能路由与自动沙箱激活。
- Warm Pool（预热池）采用"Claim-and-Go"机制，在MicroVM沙箱预先暂停状态下实现毫秒级冷启动；Agent Scheduler采用乐观并发控制和精简调度策略提升TPS。
- 两个核心CRD：`AgentRuntime`（长会话对话式Agent）和`CodeInterpreter`（短任务高频代码执行，`warmPoolSize`可配置热备沙箱数量）。
- 南向通过RuntimeClass兼容Kuasar、Kata Containers、Firecracker等安全容器；北向目标适配Dify、LangChain、CrewAI、LlamaIndex等主流Agent框架；提供Python SDK降低接入门槛。
- Volcano是CNCF首个也是唯一的批量计算项目，已支持Spark、Flink、[[Ray]]、TensorFlow、PyTorch等众多框架。

## Visual observations

*No load-bearing images — all panels decorative (logos, architecture diagrams redundant with body text).*

## Entities touched

[[Kubernetes]], [[Ray]]

## Topics touched

[[Agentic AI Infrastructure]]

## Raw source

[mp.weixin.qq.com/s/AeGy0xq-Da1sYTpY3ssMaQ](https://mp.weixin.qq.com/s/AeGy0xq-Da1sYTpY3ssMaQ) — 公众号 AGENT魔方，2026-01-09. Read 2026-05-15.
