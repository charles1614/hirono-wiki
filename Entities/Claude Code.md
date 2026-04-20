---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-20'
type: entity
refs: 6
tier: active
---

# Claude Code

[[Anthropic]]'s coding-focused agent CLI. Reaches into your repo via shell + file tools + (often) [[MCP]] servers; iterates with checkpoint-heavy workflows. Used internally across 10+ Anthropic teams (engineering, design, marketing, legal) — not just engineers.

## Synthesis

Thin (1 source). Position so far: Claude Code is the *implementation surface* in the "plan in [[Claude.ai]], build in Claude Code" pattern that Anthropic teams converge on. Strongly aligned with the [[Karpathy]] LLM-wiki framing of "LLM-as-programmer, human-as-curator," but applied to general code rather than knowledge management.

## Observations

- Used by 10 Anthropic teams in production: data infra, product dev, security eng, inference, data sci/ML eng, product engineering, growth marketing, product design, RL engineering, legal. — [[2026-04-20-anthropic-teams-use-claude-code]]
- "Slot machine" workflow recurring across teams: commit clean git state → let Claude run autonomously ~30 min → accept or restart fresh. — [[2026-04-20-anthropic-teams-use-claude-code]]
- ~33% one-shot success rate for small-to-medium PRs, per RL Engineering team. — [[2026-04-20-anthropic-teams-use-claude-code]]
- Vim-mode feature: ~70% of code written autonomously, few iterations to complete. — [[2026-04-20-anthropic-teams-use-claude-code]]
- Custom slash commands are the scaling primitive for repeated specialized workflows; Security Engineering owns 50% of all custom slash commands in the monorepo. — [[2026-04-20-anthropic-teams-use-claude-code]]
- [[GitHub]] Actions integration: file an issue, Claude responds with code autonomously. — [[2026-04-20-anthropic-teams-use-claude-code]]
- Visual-first prototyping (Cmd+V screenshots → working prototype) called out by Product Design and Legal. — [[2026-04-20-anthropic-teams-use-claude-code]]
