---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.anthropic.com/news/how-anthropic-teams-use-claude-code
tags: [tooling, production-deployment]
---

# [2025-07-24] How Anthropic Teams Use Claude Code

## TL;DR

Anthropic blog post profiling how internal teams across the company — from Security Engineering to Growth Marketing to Legal — use Claude Code in production workflows. The pattern: agentic coding is dissolving the technical/non-technical boundary, turning anyone who can describe a problem into someone who can build a solution.

## Key claims

- Data scientists feed entire codebases to [[Claude Code]] to get productive quickly; it reads CLAUDE.md files, explains data pipeline dependencies, and replaces traditional data catalog tools.
- Security Engineering transformed incident response: feeding stack traces + docs to Claude Code cuts 10–15 minute manual scanning to 3× faster problem resolution.
- Product Design uses Claude Code in autonomous loops (write code → run tests → iterate continuously) to prototype features; in one case built Vim key bindings for itself with minimal human review.
- Growth Marketing built a sub-agent workflow that processes CSV files of hundreds of ads, identifies underperformers, and generates new variations within character limits — reducing hours to minutes.
- Despite not knowing TypeScript, data scientists used Claude Code to build entire React applications for visualizing RL model performance via one-shot prompting.
- Legal team built prototype phone tree systems to route to the right lawyer — a non-technical team creating custom tooling without developer resources.
- Security Engineering uses Claude to ingest multiple documentation sources and create condensed markdown runbooks, which then become debugging context for production issues.
- When Kubernetes clusters stopped scheduling pods due to pod IP address exhaustion, Claude Code guided the team menu-by-menu through Google Cloud's UI until they found and fixed the issue — saving 20 minutes during a system outage.
- Key pattern: most successful teams treat Claude Code as a "thought partner," not a code generator; they explore possibilities and share discoveries across technical and non-technical users.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

Demonstrates that [[Claude Code]]'s value proposition extends far beyond developer productivity — it's enabling non-engineers (lawyers, marketers) to build custom automation, collapsing the traditional developer-as-bottleneck model.

## Entities touched

[[Claude Code]], [[Anthropic]], [[Claude]]

## Topics touched

[[Agentic AI Infrastructure]]

## Raw source

[anthropic.com/news/how-anthropic-teams-use-claude-code](https://www.anthropic.com/news/how-anthropic-teams-use-claude-code) — Anthropic blog, 2025-07-24, article. Read 2026-05-15.
