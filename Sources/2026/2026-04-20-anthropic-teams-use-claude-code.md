---
created: 2026-04-20
updated: 2026-04-20
type: source
raw_source: https://www.anthropic.com/news/how-anthropic-teams-use-claude-code
tags: [anthropic, claude-code, workflows, mcp]
highlights: true
---

# [2026-04-20] How Anthropic teams use Claude Code

## TL;DR

Survey of how 10 [[Anthropic]] teams (data infra, product dev, security eng, inference, data science/ML eng, product engineering, growth marketing, product design, RL engineering, legal) actually use [[Claude Code]] in production. Strong recurring patterns across very different jobs: a **checkpoint-heavy "slot machine" workflow** (commit clean state → let Claude run autonomously → either accept or restart fresh), a **plan-in-[[Claude.ai]]-then-build-in-[[Claude Code]]** two-step, and a **task-classification habit** (async-friendly peripheral tasks vs. sync-supervised business logic). [[MCP]] servers are the preferred surface for sensitive data access and cross-tool integration.

## Key claims

- **Checkpoint-heavy "slot machine" workflow.** Highlighted explicitly: clean git state, commit checkpoints regularly, let Claude run for ~30 min, accept or restart fresh. RL Engineering, Data Science, and Product Dev all converge on this pattern.
- **Plan in [[Claude.ai]], build in [[Claude Code]].** Legal team uses Claude.ai's conversational interface to flesh out the idea, then summarizes into a step-by-step prompt for Claude Code. Growth Marketing same pattern with thorough upfront prompt planning.
- **Async vs sync task classification.** Develop intuition for which tasks tolerate auto-accept-mode autonomy (peripheral features, prototyping, refactors) vs. need real-time supervision (core business logic, critical fixes). Product Dev articulates this most explicitly.
- **Self-sufficient verification loops.** Set up Claude to verify its own work by running builds/tests/lints — works longer autonomously and catches its own mistakes. "Generate tests before writing code" called out.
- **[[MCP]] over CLI for sensitive data.** Data Infra: use MCP servers rather than the BigQuery CLI for sensitive data — better audit/control surface. Growth Marketing built a Meta Ads MCP server for campaign analytics in [[Claude.ai]] desktop.
- **Custom Claude.md files** ("CLAUDE.md") guide tool behavior — RL Engineering: prevent repeated tool-calling mistakes (e.g., "use the right path, don't cd unnecessarily"). Product Design: tell Claude you're a designer with little coding experience.
- **Concrete numbers**: ML Eng research time down ~80% (1 hour → 10–20 min); Security Eng incident debugging 10–15 min → ~5 min; Growth Marketing ad copy 2 hours → 15 min; one-shot success rate ~33% per RL Engineering.
- **Vim mode case**: ~70% of the implementation came from Claude's autonomous work, requiring only a few iterations to complete.
- **Visual-first prototyping.** Multiple teams paste screenshots/mockups into Claude Code → working prototype. Product Design: Cmd+V mockups directly. Legal: validate accessibility tool with UCSF before deeper investment.
- **Custom slash commands.** Security Engineering owns 50% of all custom slash command implementations in the monorepo — they're the workflow primitive that scales repeated specialized tasks.
- **GitHub Actions integration.** Product Dev and Product Design file issues; Claude responds with code automatically. Reduces interface-switching.

## Entities touched

[[Anthropic]], [[Claude Code]], [[Claude.ai]], [[MCP]]

## Topics touched

[[LLM-Assisted Coding Workflows]]

## Open questions

- The "~33% one-shot success" number is from RL Engineering for small-to-medium PRs. Does this generalize across teams, or is RL eng work especially hard? The article doesn't tabulate.
- Several teams converge on the "slot machine + checkpoint" workflow without (apparently) coordinating. Is this an artifact of the dogfooding culture, or a real attractor for any team using LLM agents on code? Worth tracking against external accounts.
- The article gestures at security implications of deep MCP integrations (Legal's "MCP integration concerns") but doesn't enumerate. Real attack surface vs. compliance-aesthetic concerns?
- How does this compare to the [[Karpathy]] gist's "Obsidian is the IDE; the LLM is the programmer" framing? The labor division is the same; the tooling is different. Possibly a query-loop topic.

## Raw source

- URL: https://www.anthropic.com/news/how-anthropic-teams-use-claude-code
- Raindrop bookmark_id: 1267788158 (highlighted — 1 highlight, on the checkpoint workflow specifically)
- Captured: 2025-07-25
- Ingested: 2026-04-20
