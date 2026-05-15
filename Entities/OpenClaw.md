---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# OpenClaw

AI coding agent runtime whose observability instrumentation is the subject of this source, exposing 20 hook points across session, tool-call, LLM, and run lifecycle events.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Docker Compose deployment has a networking mismatch: CLI container defaults to `ws://127.0.0.1:18789` (loopback of its own container), not the gateway service, causing WebSocket 1006 close errors. Fixed in v2026.2+ via Unix socket shared over a compose volume mount. — [[2026-02-12-bug-docker-cli-container-cannot-reach-ga]]
- Alibaba's Qwen3.5-Plus natively integrates with OpenClaw as a third-party agent environment for web search, report generation, and vibe coding; mentioned alongside Claude Code and Cline as a first-class supported agent runtime. — [[2026-03-04-qwen3-5-blog]]
- Xiaohongshu vibe-design creator cites OpenClaw alongside Claude as a T0-tier "Taste" tool for AI product design in the Vibe Design workflow. — [[2026-03-13-理科生审美救星-vibe-design之神-小红书]]
- Architecture is "local-first, multi-device" with a WebSocket Gateway (default port 18789) as the single control plane; the Pi Agent Agentic Loop is event-driven with outer retry/profile-rotation loop, inner per-attempt LLM lifecycle, and fully SDK-managed tool execution. LLM backend is pluggable via `streamFn`; default is `@mariozechner/pi-ai`, with an Ollama override path. — [[2026-03-19-深入理解openclaw技术架构与实现原理-上]]
- As of early 2026, `sandbox.mode` defaults to off; DM sessions share context across different senders by default; proposed hardening (Issue #7827, closed completed Mar 7, 2026) adds additive "non-main" sandbox preset, `dmScope: "per-channel-peer"` DM isolation, and a documented public-agent profile denying high-risk tools (`exec`, `browser`, `web_fetch`, `gateway`, `nodes`, `cron`). — [[2026-03-17-security-default-safety-posture-sandbox-]]
