# [Security] Default Safety Posture: Sandbox & Session Isolation · Issue #7827 · openclaw/openclaw

> 原文链接: https://github.com/openclaw/openclaw/issues/7827

---

## yaront1111

> commented on Feb 20, 2026

Related: #22170 proposes Cordum as an external safety backend that complements this. Where this issue focuses on sandbox/session isolation at the runtime level, Cordum adds a policy evaluation layer *before* execution — the safety kernel evaluates every tool call against configurable policies (deny, escalate, allow) with per-tenant, per-agent scoping. Defense in depth: OpenClaw sandboxes the runtime, Cordum gates what's allowed to run in the first place.

# \[Security] Default Safety Posture: Sandbox & Session Isolation #7827

[[Security] Default Safety Posture: Sandbox & Session Isolation](#top)#7827

[bugSomething isn't working](https://github.com/openclaw/openclaw/issues?q=state%3Aopen%20label%3A%22bug%22)[securitySecurity documentation](https://github.com/openclaw/openclaw/issues?q=state%3Aopen%20label%3A%22security%22)Security documentation

[@ichbinlucaskim](https://github.com/ichbinlucaskim)

## ichbinlucaskim

> opened this on Feb 3, 2026 · Contributor

### Summary

OpenClaw’s documentation describes a “reasonably safe” deployment posture that assumes sandboxed Docker execution, non‑root users, no network egress from the sandbox, and isolated workspaces. Today, these are recommendations rather than defaults. This issue proposes moving the default posture closer to the documented model, especially for new installations and public‑facing agents.

### Motivation

OpenClaw runs a large, multi‑component codebase with capabilities such as shell execution, file operations, browser automation, and multi‑channel messaging. In this setting:

-   Sandboxing is currently opt‑in (`sandbox.mode` is off by default).
-   Direct message sessions are, by default, collapsed rather than isolated per peer/channel.
-   Public/group agents can be created with broad tool and data access unless the operator carefully constrains them.

As a result, many users are likely to deploy agents in a posture that is weaker than what the security documentation implicitly assumes, particularly when following “quick start” guides.

### Proposed Changes

#### 1\. Safer sandbox defaults for new installations

-   Set the default sandbox mode to at least `"non-main"` (or introduce a “secure preset” that does this and make it the recommended path in quick start flows).
-   Keep `sandbox.docker.network` at `"none"` for sandboxed sessions by default.
-   Recommend `workspaceAccess: "none"` in sample configurations unless an agent explicitly requires host workspace access.

#### 2\. Safer session isolation presets

-   Provide a “secure DM mode” preset that sets `dmScope: "per-channel-peer"` so that DMs from different people do not share context by default.
-   Make this preset the recommended configuration for agents that handle private or sensitive conversations.

#### 3\. Public/untrusted agent profile

-   Add a documented profile for public/group agents that:
    -   Enables sandboxing by default (e.g., `sandbox.mode: "all"`, `workspaceAccess: "none"`, `sandbox.docker.network: "none"`).
    -   Denies high‑risk tools by default (for example: `exec`, `browser`, `web_fetch`, `gateway`, `nodes`, `cron`).
    -   Avoids loading long‑term memory or broad history in shared contexts.

### Implementation Notes

-   All changes can be implemented as additive presets to avoid breaking existing setups.
-   Default changes can be scoped to new installations or gated behind explicit “secure mode” opt‑ins, with migration notes for existing environments.
-   The goal is to make the secure posture easy to adopt and clearly signposted, not to remove flexibility for advanced operators.

### Request for Maintainers

-   Would maintainers be open to introducing one or more “secure” presets as described above, and/or adjusting defaults for new installations?
-   I’m happy to follow up with small, focused PRs (one for sandbox defaults/presets, one for DM scope presets, one for a public agent profile) so we can iterate on the details incrementally.

-   [feat: secure sandbox defaults for new installs #7851](https://github.com/openclaw/openclaw/pull/7851)

-   [docs: document secure DM mode preset #7872](https://github.com/openclaw/openclaw/pull/7872)

-   [docs: add public/untrusted agent profile #7874](https://github.com/openclaw/openclaw/pull/7874)

-   [Security: Public/Group Agents: Safer Tool & Data Surface #7830](https://github.com/openclaw/openclaw/issues/7830)

-   [[Security] Sub-agents bypass exec approvals for safeBins commands #10992](https://github.com/openclaw/openclaw/issues/10992)

-   [[Security] Sub-agents bypass exec approvals #10993](https://github.com/openclaw/openclaw/issues/10993)

## luckyPipewrench

> commented on Feb 9, 2026

For the network egress piece, Pipelock can sit between the sandbox and the internet as a scanning proxy. Blocks credential exfiltration via DLP patterns, entropy analysis, and SSRF protection. Has a `generate docker-compose` command that outputs the isolation setup.

[https://github.com/luckyPipewrench/pipelock](https://github.com/luckyPipewrench/pipelock)

-   [Per-channel tool isolation: channel compromise should not grant full agent access #14252](https://github.com/openclaw/openclaw/issues/14252)

## theMachineClay

> commented on Feb 19, 2026

Adding context from two related threads:

-   **Runtime sandboxing** (Phase 3 of the Skill Security RFC): I've commented on [RFC: Skill Security Framework — Permission Manifests, Signing, and Sandboxing #10890](https://github.com/openclaw/openclaw/issues/10890) with a working capability-based sandbox ([SkillSandbox](https://github.com/theMachineClay/skillsandbox)) that enforces network/filesystem/syscall restrictions per skill. Could serve as the enforcement backend for the sandbox defaults proposed here.

-   **Session-aware policy enforcement**: I've commented on [[Security] Agent Runtime: Zero Prompt Injection Detection (Enabler Role) #12558](https://github.com/openclaw/openclaw/issues/12558) with [AgentTrace](https://github.com/theMachineClay/agenttrace), a session-state policy engine that tracks cumulative violations and costs. Relevant to the "secure DM mode" and per-channel isolation proposed here — policy enforcement needs session context, not just per-message checks.

Both integrate via MCP and OpenTelemetry. Happy to help with PRs for the sandbox defaults and session isolation presets described in this issue.

-   [feat: implement 3 high-impact security/optimization features #34185](https://github.com/openclaw/openclaw/pull/34185)

## vincentkoc

> commented on Mar 8, 2026 · Member

Thanks for writing this up. After checking this against `SECURITY.md` and the current code/docs, we don’t think this is a security vulnerability, so we’re going to close it as hardening / product-direction rather than security.

A few important points:

-   OpenClaw’s documented trust model is personal-assistant / trusted-operator, not hostile multi-tenant isolation on a shared gateway.
-   In that model, sandboxing is intentionally opt-in today. `agents.defaults.sandbox.mode=off` is documented behavior, not a boundary bypass.
-   Shared/public deployments are already called out as requiring additional lock-down: separate trust boundaries, stricter tool policy, sandboxing, allowlists, and mention gating.
-   Part of this issue is already addressed for new installs: local onboarding now defaults `session.dmScope` to `per-channel-peer` when unset, and the security docs already document this as the recommended “secure DM mode.”
-   We also already warn on the risky cases this issue describes via security audit findings for multi-user DM sharing, open groups with risky tools, and likely multi-user/shared-trust setups.

So the remaining request here is essentially: “make safer presets/defaults easier and more opinionated for new/shared/public setups.” That’s a valid product/hardening idea, but it is not a security bug under our current policy.

If someone wants to follow up with focused PRs for:

-   a stronger optional secure preset,
-   a documented public/shared-agent profile,
-   or additional onboarding nudges for shared deployments,

we’d review those on their merits.

Closing as no-action on the security side.
