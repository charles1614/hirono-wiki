---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Workers AI

Cloudflare's serverless AI inference platform for large language models

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Now hosts Kimi K2.5 with prefix caching (surfaced as a usage metric with discount), session-affinity routing via `x-session-affinity` header, and a redesigned pull-based async API that processes queued requests within ~5 minutes when GPU headroom exists. — [[2026-03-24-powering-the-agents-workers-ai-now-runs-]]
