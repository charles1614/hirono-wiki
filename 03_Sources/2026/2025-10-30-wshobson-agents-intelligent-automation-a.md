---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/wshobson/agents?tab=readme-ov-file#quick-start
tags: [claude-code, agent-framework, developer-tooling, github-repo]
---

# [2025-10-30] wshobson/agents: Claude Code Plugins for Intelligent Automation

## TL;DR

Open-source repository providing 185 specialized AI agents, 16 multi-agent workflow orchestrators, 153 agent skills, and 100 commands organized into 80 single-purpose [[Claude Code]] plugins, using a three-tier model strategy (Opus 4.7 / Sonnet 4.6 / Haiku 4.5) and progressive skill disclosure to minimize token usage while covering full-stack software development workflows.

## Key claims

- Plugin marketplace installs via `/plugin marketplace add wshobson/agents`; no agents are loaded until explicitly installed, keeping context minimal.
- Three-tier model assignment: Tier 1 = Opus 4.7 for 42 critical agents (architecture, all code review, production coding); Tier 2 = `inherit` for 42 complex-task agents; Tier 3 = Sonnet 4.6 for 51 support agents; Tier 4 = Haiku 4.5 for 18 fast operational agents.
- Opus 4.7 rationale: 80.8% on SWE-bench (industry-leading), 65% fewer tokens on complex tasks; pricing $5/$25 per million input/output tokens vs Sonnet $3/$15 and Haiku $1/$5.
- 153 agent skills use three-tier progressive disclosure: metadata (always loaded, ~name + trigger), instructions (on activation), resources (on demand) — installing `python-development` loads ~1,000 tokens not the full marketplace.
- PluginEval framework provides static + LLM-judge + Monte Carlo statistical evaluation across 10 quality dimensions with Wilson/Clopper-Pearson confidence intervals and Elo ranking.
- Repository structure: 80 plugins under `plugins/<name>/{agents,commands,skills}/`; each plugin has single responsibility and average 3.6 components.
- Now also available as native Gemini CLI extension with 153 skills discoverable on-demand without installing plugins.
- Conductor plugin transforms [[Claude Code]] into project management with Context → Spec & Plan → Implement TDD workflow and semantic revert by logical unit.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[Claude Code]]

## Topics touched

[[Agentic AI Infrastructure]]

## Raw source

[github.com/wshobson/agents](https://github.com/wshobson/agents?tab=readme-ov-file#quick-start) — GitHub README, updated for Opus 4.7/Sonnet 4.6/Haiku 4.5. Read 2026-05-15.
