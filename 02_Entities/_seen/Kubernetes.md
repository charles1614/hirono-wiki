---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Kubernetes

Open-source container orchestration platform (CNCF); SIG Apps released Agent Sandbox CRD for AI agent workloads

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- SIG Apps released Agent Sandbox CRD for AI agent workloads: gVisor/Kata kernel isolation, idle-to-zero lifecycle, stable per-agent hostname, WarmPool pre-warming; provisioned via a single SandboxClaim resource. — [[2026-03-23-k8s官方出手-agent沙箱来了-小红书]]
- Volcano's AgentCube project (Jan 2026) identifies four K8s gaps for Agent workloads: Pod cold-start latency (seconds vs. milliseconds needed), CPU/memory waste during 90% wait time, stateless-by-default causing context loss on restart, and lack of strong MicroVM isolation for untrusted code. AgentCube extends K8s with AgentRuntime + CodeInterpreter CRDs, Warm Pool "Claim-and-Go" pre-warming, and Volcano Agent Scheduler with optimistic concurrency for millisecond allocation. — [[2026-01-11-重磅-volcano发布agentcube-构建ai-agent时代的云原生基础]]
