---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/openclaw/openclaw/issues/7827
tags: [tooling, security, openclaw]
---

# [2026-03-17] [Security] Default Safety Posture: Sandbox & Session Isolation · Issue #7827

## TL;DR

GitHub issue #7827 on `openclaw/openclaw` proposing that OpenClaw's default deployment posture be hardened to match its own security documentation. Currently sandboxing is opt-in, DM sessions share context across peers by default, and public-agent tool access is unconstrained. The issue proposes three additive changes: safer sandbox defaults, per-peer DM isolation presets, and a documented public/untrusted agent profile.

## Key claims

- OpenClaw's `sandbox.mode` is **off by default**; sandboxed Docker execution with non-root users and no network egress is documented as "reasonably safe" but not enforced. — Issue §Motivation
- DM sessions collapse context across different senders by default (`dmScope` is not `per-channel-peer`), meaning different users share conversation history unless the operator explicitly configures isolation. — Issue §Motivation
- Proposed fix 1: set default sandbox mode to at least `"non-main"` and keep `sandbox.docker.network: "none"` for sandboxed sessions; recommend `workspaceAccess: "none"` in sample configs. — Issue §1
- Proposed fix 2: add a "secure DM mode" preset setting `dmScope: "per-channel-peer"` as the recommended default for agents handling private conversations. — Issue §2
- Proposed fix 3: document a public/group agent profile that enables `sandbox.mode: "all"`, `workspaceAccess: "none"`, `sandbox.docker.network: "none"`, and denies high-risk tools (`exec`, `browser`, `web_fetch`, `gateway`, `nodes`, `cron`) by default. — Issue §3
- All changes are framed as **additive presets** to avoid breaking existing setups; default changes can be gated behind opt-in "secure mode" with migration notes. — Issue §Implementation Notes
- Issue was closed as **completed** (Mar 7, 2026) and assigned to maintainer vincentkoc. — Source metadata

## Visual observations

*No load-bearing images — text-only GitHub issue*

## Entities touched

[[OpenClaw]]

## Topics touched

[[Agentic AI Infrastructure]]

## Raw source

[github.com/openclaw/openclaw/issues/7827](https://github.com/openclaw/openclaw/issues/7827) — Labels: `bug`, `security`; closed completed Mar 7, 2026; assigned vincentkoc. Read 2026-05-15.
