---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/openclaw/openclaw/pull/11553
tags: [agent-frameworks, observability]
---

# [2026-02-08] feat(docker): add sandbox browser service · PR #11553 · openclaw/openclaw

## TL;DR
A closed (not merged, marked stale) PR to openclaw/openclaw that proposed adding an `openclaw-browser` Docker service with Chromium/CDP (port 9222), VNC (port 5900), and noVNC (port 6080) to enable sandboxed browser automation for agents running in Docker. Closed due to inactivity after Greptile identified a YAML parse error in the compose file that would have broken all Docker deployments.

## Key claims
- The `openclaw-browser` service was designed to expose CDP on port 9222, VNC on 5900, and a noVNC web interface on 6080; both headless and headful modes were configurable via env vars.- PR was closed Mar 12, 2026 without merging; root blocking issue was a trailing comma in the `openclaw-gateway.command` YAML flow sequence, making `docker-compose.yml` invalid.- Additional review issues: undocumented port 18792 exposed on gateway, incorrect `docker compose down <service>` command in docs, and mismatched browser profile name (`openclaw` vs `docker-browser`) in the quickstart.- Greptile confidence score 2/5 — not suitable for merge in current state.
## Visual observations
*No images — text-only GitHub PR.*

## Entities touched

## Topics touched
[[Agentic AI Infrastructure]]

## Raw source
[github.com/2026-02-12-feat-docker-add-sandbox-browser-service-](https://github.com/openclaw/openclaw/pull/11553) — GitHub PR, closed not merged, openclaw/openclaw. Read 2026-05-15.
