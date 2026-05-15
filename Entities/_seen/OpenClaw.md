---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# OpenClaw

AI coding agent runtime whose observability instrumentation is the subject of this source, exposing 20 hook points across session, tool-call, LLM, and run lifecycle events.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Docker Compose deployment has a networking mismatch: CLI container defaults to `ws://127.0.0.1:18789` (loopback of its own container), not the gateway service, causing WebSocket 1006 close errors. Fixed in v2026.2+ via Unix socket shared over a compose volume mount. — [[2026-02-12-bug-docker-cli-container-cannot-reach-ga]]
