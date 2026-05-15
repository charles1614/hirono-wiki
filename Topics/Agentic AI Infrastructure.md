---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 23
---

# Agentic AI Infrastructure

## What

Hardware and system-software infrastructure purpose-built for agentic AI workloads — where AI systems plan multi-step tasks, dispatch tools, execute code, retrieve data, and validate results. Distinct from standard LLM inference infrastructure in that the CPU-side orchestration tier becomes a first-class scaling constraint.

## Current understanding

Agentic AI shifts the CPU from a peripheral host into a central coordinator: the model issues function calls, tool dispatches, and validation steps that must complete at inference latency, not human-interactive latency. [[NVIDIA]]'s [[Vera CPU]] launch (GTC 2026) is the first hardware move to address this directly — 88 custom Olympus cores, LPDDR5X at 1.2 TB/s, and NVLink-C2C at 1.8 TB/s coherent bandwidth to [[Rubin]] GPUs, arguing that CPU-GPU PCIe bandwidth is now the bottleneck for high-throughput agentic pipelines [[2026-03-17-nvidia-launches-vera-cpu-purpose-built-f]].

The architectural thesis is that agentic scale requires co-designed CPU + GPU + interconnect + chassis — a vertical integration posture matching Google's AI Hypercomputer framing. A single Vera rack hosts 256 liquid-cooled CPUs for >22,500 concurrent CPU environments, targeting AI factories running many simultaneous agents. Vera also pairs as the host CPU for HGX Rubin NVL8 GPU systems, covering both CPU-primary and GPU-primary workloads under a unified platform.

Reinforcement learning is co-cited alongside agentic inference as a primary Vera target workload — both generate CPU-bound orchestration load (reward evaluation, environment stepping, code execution) that current GPU server designs under-provision.

**AutoResearch-style agentic loops demonstrate the software pattern that Vera-class hardware targets.** [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]] shows [[AutoResearch]] applied to CUDA kernel authoring: the model issues tool calls (compile, benchmark, ncu profile, web search, PTX analysis) in a tight loop, each completing at software latency. The bottleneck was daily API quota, not compute. This is the workload character Vera's 256 CPUs-per-rack design addresses: many concurrent CPU environments executing orchestration-heavy agent loops.

## Open threads

- Competitive response: AMD, Intel, and Arm-ecosystem players have not yet published purpose-built agentic-CPU silicon; will the workload characterization hold as competitors respond?
- Benchmarks: Vera's claimed 2× efficiency and 50% speed uplift are NVIDIA assertions at launch — independent HPC site data (TACC Horizon deployment, LBNL/NERSC) will be the first credible validation.
- Software stack: what orchestration runtimes (LangGraph, AutoGen, NVIDIA NIM Agent Blueprints) are validated on Vera, and does the 1.8 TB/s NVLink-C2C coherence actually surface at the application layer?

## Sources drawn on

- [[2026-03-17-nvidia-launches-vera-cpu-purpose-built-f]] — GTC 2026 press release introducing Vera CPU, NVLink-C2C integration, and the agentic-AI-first CPU thesis.
- [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]] — AutoResearch kernel authoring case study; illustrates the tool-call-dense CPU workload pattern Vera targets.
- [[2026-03-24-powering-the-agents-workers-ai-now-runs-]] — Cloudflare Workers AI adding frontier models + prefix caching + async API for production agentic workloads; 77% cost reduction in real use case.
- [[2026-03-23-k8s官方出手-agent沙箱来了-小红书]] — Kubernetes SIG Apps Agent Sandbox CRD addressing agent-native workload characteristics (singleton, long-running, bursty, untrusted code).
- [[2026-03-24-new-released-overview-z-ai-developer-doc]] — Z.AI GLM series release notes showing industry progression toward 8-hour autonomous engineering agents.
- [[2026-03-19-深入理解openclaw技术架构与实现原理-上]] — Architectural deep-dive into OpenClaw: Gateway control plane, Pi Agentic Loop, cron, channels, Docker sandbox isolation.
- [[2026-03-17-security-default-safety-posture-sandbox-]] — OpenClaw Issue #7827: default sandbox/session-isolation hardening proposals (closed completed Mar 7, 2026).
- [[2026-01-14-ai交互的革命-从操作现有软件-到生成未来软件]] — API/GUI/GenUI三重范式演进；[[Li Auto]]理想同学MCP+CUA混合架构落地案例；Google GenUI生成式UI范式。
- [[2026-01-11-重磅-volcano发布agentcube-构建ai-agent时代的云原生基础]] — AgentCube (Volcano/CNCF): K8s extension for Agent workloads with Warm Pool + Claim-and-Go MicroVM pre-warming, Volcano Agent Scheduler, and AgentRuntime + CodeInterpreter CRDs.
- [[2026-01-10-姚顺雨对着唐杰杨植麟林俊旸贴大脸开讲-基模四杰中关村论英雄]] — AGI-Next summit: Chat→Agent shift requires full-async RL, API+GUI hybrid interaction, and "three Scalings" (data/model + inference compute + self-learning environment).

## Observations

- [[Anthropic]] Skills Guide (Feb 2026): Skills are folder-based reusable instruction packages with progressive 3-layer loading (~100-token YAML frontmatter always resident → SKILL.md body on-demand → scripts/references on-demand). Primary patterns: sequential orchestration, multi-MCP coordination, iterative optimization, context-aware tool selection, domain-specific compliance-first logic. — [[2026-02-19-春节加餐-anthropic首个公开的skills构建指南来了]]
- OpenClaw Docker sandbox browser PR (#11553, closed not merged): proposed `openclaw-browser` service with Chromium/CDP on port 9222, VNC on 5900, noVNC on 6080 for sandboxed agent browser automation; blocked by YAML parse error (trailing comma) in `docker-compose.yml`. — [[2026-02-12-feat-docker-add-sandbox-browser-service-]]
- OpenClaw Docker NAT pairing bug (#6959): Docker Desktop NAT causes gateway to classify browser connections as external (IP 192.168.65.0/24), triggering device-pairing requirement. Fix: `allowInsecureAuth: true` + `trustedProxies` in gateway JSON config inside container. — [[2026-02-12-fix-disconnected-1008-pairing-required-e]]
- Three agentic RL systems (Kimi K2.5 PARL, Cursor Composer 2, Chroma Context-1) demonstrate a common infrastructure pattern: train inside the production harness, use outcome rewards, and invest in large-scale async rollout infrastructure; context management (self-summarization, parallel sub-agents, context pruning) is a first-class engineering problem in all three. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
- Community AutoResearch practitioners confirm reward specification as the binding constraint: ill-specified evaluation criteria cause autonomous optimization to diverge from intent; this generalizes beyond RL post-training to any agent-in-the-loop optimization loop. — [[2026-03-24-全自动科研-真的建议早点接触-小红书]]
- Practitioner Vibe Design workflow for STEM engineers: [[Claude]] and AI design tools cited as T0-tier enablers for achieving product aesthetic quality without a design background, signaling that agentic coding tooling is expanding to cover the aesthetic / UX layer, not just code generation. — [[2026-03-13-理科生审美救星-vibe-design之神-小红书]]
- [[Ghostty]] terminal adoption pattern as agentic infrastructure: [[Claude Code]] team runs 5 parallel instances simultaneously using Ghostty split-pane + GPU-rendered scrolling; a practitioner replicated the workflow (Claude Code + yazi + lazygit split-pane) configured entirely by asking Claude Code in one sentence. — [[2026-03-13-claude-code团队都在使用的终端软件ghostty-小红书]]
- API vs GUI vs GenUI Agent交互范式演进：API Agent受限于接口开放度（高效精准）；GUI Agent通过多模态截屏点击实现通用性（速度慢、对改版脆弱）；Generative UI直接生成用户专属交互界面（从操作者到创造者）。[[Li Auto]]理想同学MCP+CUA混合架构是GPU+GUI双脑协同的工业级落地案例。 — [[2026-01-14-ai交互的革命-从操作现有软件-到生成未来软件]]
- Alibaba Cloud Agentic Search (released at 2025 云栖大会) is a multi-Agent coordinated architecture for LLM-era search: main Agent ([[Qwen]]3 + short/long-term memory) dynamically dispatches Code Agent and Browser Agent; claims to beat Gemini and OpenAI on OpenAI BrowseComp + Deep Research by >40% complex task accuracy. Data infrastructure: vector+full-text hybrid retrieval, multi-modal document parsing, knowledge graph integration. — [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]]
