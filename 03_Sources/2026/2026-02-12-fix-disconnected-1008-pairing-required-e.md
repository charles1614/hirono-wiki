---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/openclaw/openclaw/issues/6959
tags: [agent-frameworks, observability]
---

# [2026-02-02] Fix "disconnected (1008): pairing required" Error in OpenClaw Docker · Issue #6959

## TL;DR
A community-documented fix for a common OpenClaw Docker issue: Docker Desktop's NAT networking causes the gateway to see browser connections as external (IP 192.168.65.1) rather than local, triggering device-pairing requirements that browsers cannot satisfy. The fix adds `trustedProxies` and `allowInsecureAuth: true` to the gateway config.

## Key claims
- Root cause: Docker's NAT translates `localhost:18789` connections to source IP `192.168.65.1`; the OpenClaw gateway classifies this as external, which requires device pairing that browser clients cannot complete.- Fix requires creating `/home/node/.openclaw/openclaw.json` inside the container with `allowInsecureAuth: true` and `trustedProxies: ["192.168.65.0/24", "172.17.0.0/16"]`; config changes on the host machine have no effect unless properly volume-mounted.- Access must use a tokenized URL (`http://localhost:18789/?token=<token>`) rather than plain localhost after applying the fix.- Issue closed as duplicate of #4941; verified on macOS Docker Desktop with OpenClaw 2026.1.30 and Docker Compose v2.
## Visual observations
*No images — text-only GitHub issue with code blocks.*

## Entities touched

## Topics touched
[[Agentic AI Infrastructure]]

## Raw source
[github.com/2026-02-12-fix-disconnected-1008-pairing-required-e](https://github.com/openclaw/openclaw/issues/6959) — GitHub Issue, closed (duplicate of #4941), openclaw/openclaw. Read 2026-05-15.
