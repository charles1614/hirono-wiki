---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://gist.github.com/alirezarezvani/a0f6e0a984d4a4adc4842bbe124c5935
tags: [tooling, production-deployment]
---

# [2025-10-28] Ultimate Guide to Extending Claude Code with Skills, Agents, Commands, and Utilities

## TL;DR

Comprehensive guide by Alireza Rezvani covering a three-repository ecosystem for extending Claude Code: Tresor (8 autonomous skills + 8 agents + 4 commands ready-to-use), Skill Factory (generate custom domain skills via prompts), and Claude Skills Library (26+ domain packages across marketing, engineering, product, PM, and C-level advisory roles).

## Key claims

- **Claude Code Tresor** provides 8 autonomous skills (code-reviewer, test-generator, git-commit-helper, security-auditor, secret-scanner, dependency-auditor, api-documenter, readme-updater), 8 expert agents, 4 workflow slash commands (`/scaffold`, `/review`, `/test-gen`, `/docs-gen`), 20+ prompt templates, and 5 dev standards.
- **Skills** activate automatically on triggers (file save, pre-commit) defined in YAML frontmatter; **Agents** are invoked via `@agent-name`; **Slash Commands** orchestrate multi-step workflows.
- **Skill Factory** generates complete multi-file skill packages (with Python code) or single-file agents from a domain description prompt; uses "smart architecture" to determine when code is needed vs. prompt-only.
- **Claude Skills Library** contains 26 packages across 5 professional domains; claims 40%+ time savings and 30%+ quality improvement with domain-specific guidance.
- All installed to `~/.claude/skills/`, `~/.claude/agents/`, `~/.claude/commands/`; can be disabled by renaming the folder with `.disabled` suffix.
- All three repositories are MIT licensed; skills with Python code can call external APIs.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Claude Code]]

## Topics touched

## Raw source

[gist.github.com/alirezarezvani/a0f6e0a984d4a4adc4842bbe124c5935](https://gist.github.com/alirezarezvani/a0f6e0a984d4a4adc4842bbe124c5935) — GitHub gist by Alireza Rezvani; last updated 2026-05-09; content dated October 28, 2025. Read 2026-05-15.
