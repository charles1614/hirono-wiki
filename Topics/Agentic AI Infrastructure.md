---
created: 2026-05-15
updated: 2026-05-17
type: topic
source_count: 32
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
- [[2025-10-15-megaflow-large-scale-distributed-orchest]] — MegaFlow three-service agent training infrastructure; many-small-instances over few-large; 32% cost reduction at 10,000 concurrent tasks.

## Observations

- MegaFlow demonstrates that in large-scale agent training (software engineering + computer use tasks), the primary bottleneck is not model compute but environment orchestration (container provisioning, security isolation, storage for 25+ TB of container images per benchmark); delegating container lifecycle to open-source frameworks (SWE-Agent, OpenHands) while MegaFlow handles scheduling, resource management, and event-driven monitoring is more effective than building monolithic infrastructure. — [[2025-10-15-megaflow-large-scale-distributed-orchest]]
- [[2026-03-17-security-default-safety-posture-sandbox-]] — OpenClaw Issue #7827: default sandbox/session-isolation hardening proposals (closed completed Mar 7, 2026).
- [[2026-01-14-ai交互的革命-从操作现有软件-到生成未来软件]] — API/GUI/GenUI三重范式演进；[[Li Auto]]理想同学MCP+CUA混合架构落地案例；Google GenUI生成式UI范式。
- [[2026-01-11-重磅-volcano发布agentcube-构建ai-agent时代的云原生基础]] — AgentCube (Volcano/CNCF): K8s extension for Agent workloads with Warm Pool + Claim-and-Go MicroVM pre-warming, Volcano Agent Scheduler, and AgentRuntime + CodeInterpreter CRDs.
- [[2026-01-10-姚顺雨对着唐杰杨植麟林俊旸贴大脸开讲-基模四杰中关村论英雄]] — AGI-Next summit: Chat→Agent shift requires full-async RL, API+GUI hybrid interaction, and "three Scalings" (data/model + inference compute + self-learning environment).
- [[2025-07-23-wavetermdev-waveterm-an-open-source-cros]] — Wave Terminal: open-source AI-integrated terminal with BYOK multi-model support, durable SSH sessions, and wsh CLI system for agentic workspace management.

## Observations

- [[Anthropic]] Skills Guide (Feb 2026): Skills are folder-based reusable instruction packages with progressive 3-layer loading (~100-token YAML frontmatter always resident → SKILL.md body on-demand → scripts/references on-demand). Primary patterns: sequential orchestration, multi-MCP coordination, iterative optimization, context-aware tool selection, domain-specific compliance-first logic. — [[2026-02-19-春节加餐-anthropic首个公开的skills构建指南来了]]
- OpenClaw Docker sandbox browser PR (#11553, closed not merged): proposed `openclaw-browser` service with Chromium/CDP on port 9222, VNC on 5900, noVNC on 6080 for sandboxed agent browser automation; blocked by YAML parse error (trailing comma) in `docker-compose.yml`. — [[2026-02-12-feat-docker-add-sandbox-browser-service-]]
- OpenClaw Docker NAT pairing bug (#6959): Docker Desktop NAT causes gateway to classify browser connections as external (IP 192.168.65.0/24), triggering device-pairing requirement. Fix: `allowInsecureAuth: true` + `trustedProxies` in gateway JSON config inside container. — [[2026-02-12-fix-disconnected-1008-pairing-required-e]]
- AgentCube (Volcano/CNCF, Jan 2026) quantifies four K8s gaps for Agent workloads: Pod cold-start seconds vs. milliseconds needed, CPU/memory idling 90% of wait time, stateless-by-default context loss, and no strong MicroVM isolation for untrusted code. Solutions: Warm Pool "Claim-and-Go" MicroVM pre-warming (millisecond allocation), Session ID-based router with auto sandbox activation, Volcano Agent Scheduler with optimistic concurrency, AgentRuntime + CodeInterpreter CRDs with declarative `warmPoolSize` hot-standby configuration. — [[2026-01-11-重磅-volcano发布agentcube-构建ai-agent时代的云原生基础]]
- Three agentic RL systems (Kimi K2.5 PARL, Cursor Composer 2, Chroma Context-1) demonstrate a common infrastructure pattern: train inside the production harness, use outcome rewards, and invest in large-scale async rollout infrastructure; context management (self-summarization, parallel sub-agents, context pruning) is a first-class engineering problem in all three. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
- Community AutoResearch practitioners confirm reward specification as the binding constraint: ill-specified evaluation criteria cause autonomous optimization to diverge from intent; this generalizes beyond RL post-training to any agent-in-the-loop optimization loop. — [[2026-03-24-全自动科研-真的建议早点接触-小红书]]
- Practitioner Vibe Design workflow for STEM engineers: [[Claude]] and AI design tools cited as T0-tier enablers for achieving product aesthetic quality without a design background, signaling that agentic coding tooling is expanding to cover the aesthetic / UX layer, not just code generation. — [[2026-03-13-理科生审美救星-vibe-design之神-小红书]]
- [[Ghostty]] terminal adoption pattern as agentic infrastructure: [[Claude Code]] team runs 5 parallel instances simultaneously using Ghostty split-pane + GPU-rendered scrolling; a practitioner replicated the workflow (Claude Code + yazi + lazygit split-pane) configured entirely by asking Claude Code in one sentence. — [[2026-03-13-claude-code团队都在使用的终端软件ghostty-小红书]]
- API vs GUI vs GenUI Agent交互范式演进：API Agent受限于接口开放度（高效精准）；GUI Agent通过多模态截屏点击实现通用性（速度慢、对改版脆弱）；Generative UI直接生成用户专属交互界面（从操作者到创造者）。[[Li Auto]]理想同学MCP+CUA混合架构是GPU+GUI双脑协同的工业级落地案例。 — [[2026-01-14-ai交互的革命-从操作现有软件-到生成未来软件]]
- Alibaba Cloud Agentic Search (released at 2025 云栖大会) is a multi-Agent coordinated architecture for LLM-era search: main Agent ([[Qwen]]3 + short/long-term memory) dynamically dispatches Code Agent and Browser Agent; claims to beat Gemini and OpenAI on OpenAI BrowseComp + Deep Research by >40% complex task accuracy. Data infrastructure: vector+full-text hybrid retrieval, multi-modal document parsing, knowledge graph integration. — [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]]
- [[Anthropic]] internal teams demonstrate the non-engineering adoption frontier: Legal built phone-tree routing prototypes; Growth Marketing deployed two-sub-agent CSV workflows producing hundreds of ad variations in minutes; data scientists built complete TypeScript/React RL visualization dashboards via one-shot prompting without TypeScript knowledge. The cross-functional pattern: agentic coding collapses the technical/non-technical boundary when teams treat the agent as a thought partner rather than a code generator. — [[2025-07-25-how-anthropic-teams-use-claude-code-anth]]
- [[Claude Code]] sub-agent best practices from community (linux.do, 2025-07-29): sub-agents should be scaffolded in `.claude/agents/` directories, not encoded in CLAUDE.md directly; global CLAUDE.md at `~/.claude/` provides base rules; project-level CLAUDE.md in project root for project specifics; agent config changes require restart to take effect. Community recommends minimal CLAUDE.md (base rules only) since it is sent every round-trip. — [[2025-07-29-基于claude-code新出的功能sub-agent-写了个动态生成的clau]]
- wshobson/agents provides 185 specialized [[Claude Code]] agents in 80 single-purpose plugins with 153 progressive-disclosure skills; three-tier model strategy (Opus 4.7 / Sonnet 4.6 / Haiku 4.5) and average 3.6 components/plugin minimize token usage while delivering full-stack coverage; PluginEval framework offers three-layer quality certification with Elo ranking. — [[2025-10-30-wshobson-agents-intelligent-automation-a]]
- [[Claude Code]] pre-flight Haiku call for Bash tool validation: Bash tool invocations are gated on a small-model API call; AWS Bedrock 403 from missing model access caused ~210-second hangs; debugging required `ANTHROPIC_LOG=debug`; fix is enabling Bedrock model access or setting `ANTHROPIC_SMALL_FAST_MODEL`. — [[2025-10-29-significant-pre-execution-delay-210s-whe]]
- Alibaba Cloud practitioner retrospective on [[Claude Code]]: key behavioral patterns for high-quality output — CO-STAR + pseudo-XML prompting, task-boundary by competency level, step-by-step validation, defensive review posture, context compression with `/compact`, `git worktree` for parallel instances. Confirms that context management and task granularity are the primary bottlenecks beyond prompt quality. — [[2025-07-30-如何用ai-coding和claude-code提升开发效率-看我的全流程复盘]]
- [[Pine AI]] production agent system demonstrates three knowledge-expression modalities for experience learning: (1) code-generated RPA tools (fixed sequences as atomic sub-tools); (2) knowledge base (per-company procedural memory); (3) SFT/RL into model parameters (high-frequency tasks as "muscle memory"). The RL constraint: it cannot create new outputs the base model has never produced — it only raises proficiency on known-good trajectories. On Tau-Bench Airline: Claude 4 Sonnet baseline 56% → sequential-revision 64%; 8/18 failures were ground-truth annotation errors. — [[2025-06-14-能办成事的-agent-实时与环境交互-从经验中学习]]
- [[Tencent]]'s [[TencentDB Agent Memory]] (May 2026) proposes a two-pillar architecture for Agent memory: (1) symbolic short-term memory — verbose tool logs offloaded to `refs/*.md` while only a Mermaid task canvas (with `node_id` anchors for drill-down) stays in context; (2) layered long-term memory — L0 Conversation → L1 Atom → L2 Scenario → L3 Persona pyramid. Heterogeneous storage: lower-layer evidence in databases, upper-layer abstractions as human-readable Markdown for white-box inspection. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
- Reported as a concrete remedy to "irreversible lossy summarization" — preserves full traceability via L3 Persona → L2 Scenario → L1 Atom → L0 Conversation drill-down chain linked by `result_ref` / `node_id`. Token-cost reductions (61.38% on WideSearch, 33.09% on SWE-bench over 50-task sessions) are large enough to matter for production agent serving. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
