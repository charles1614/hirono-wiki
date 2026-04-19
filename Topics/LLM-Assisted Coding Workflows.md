---
created: 2026-04-20
updated: 2026-04-20
type: topic
source_count: 1
---

# LLM-Assisted Coding Workflows

The patterns that surface when humans actually use LLM coding agents day-to-day. Distinct from the question of "can an LLM write code" — this is about *how a person organizes their work* around an agent that can sometimes finish the job autonomously and sometimes goes off track.

## Current understanding

A small set of patterns recur across very different teams and tasks (per [[2026-04-20-anthropic-teams-use-claude-code]]):

1. **Checkpoint-heavy "slot machine."** Commit clean state, let the agent run autonomously for ~30 min, accept or restart fresh. *Don't* try to wrestle a half-broken result into shape; rolling back is cheaper. RL Engineering, Data Science, and Product Dev all converge here independently.
2. **Plan in chat, build in agent.** [[Claude.ai]] for thinking through the spec, [[Claude Code]] for executing it. Legal and Growth Marketing both name this two-step.
3. **Task classification: async vs sync.** Peripheral features, prototypes, refactors → auto-accept mode, low supervision. Core business logic and critical fixes → real-time review. Product Dev articulates the rule.
4. **Self-verifying loops.** Have the agent run builds/tests/lints itself; preferably write tests *before* implementing. Lets it work longer autonomously and catch its own mistakes.
5. **Per-repo memory files** (CLAUDE.md / Claude.md) encoding workflow conventions, tool-calling habits, and audience ("I'm a designer; explain in small steps"). Quality of output rises sharply.
6. **[[MCP]] over CLI for sensitive integrations** — better audit, better composition, less leakage of secrets through transient shell sessions.
7. **Visual-first prototyping** — paste screenshots/mockups directly to the agent; iterate on the visual, not on the text describing the visual.

The labor split that makes this work mirrors the [[Karpathy]] LLM-wiki framing: the LLM does the implementation grunt work; the human curates, supervises, and decides what's worth keeping. Same pattern, different artifacts (code vs. wiki pages).

## Open threads

- Calibration: ~33% one-shot success on small-to-medium PRs (RL eng) is concrete but narrow. Does this hold across more teams, more languages, more codebases?
- The "slot machine" pattern says **don't** debug the agent's mistake — start over. When does that break down? Probably for unique state (production hotfixes, content edits) where restart isn't cheap.
- "Plan in Claude.ai, build in Claude Code" is a two-step. With longer agent context windows, does the planning step collapse into the agent itself? Or does the human's planning surface stay separate-by-design (decoupled from the implementation context)?
- Custom slash commands as Security Eng's force multiplier is striking. Is this transferable, or specific to teams with a high-volume of stylized repeated tasks?

## Sources drawn on

- [[2026-04-20-anthropic-teams-use-claude-code]] — survey of 10 Anthropic teams' patterns; concrete numbers on time savings and one-shot rates
- (Adjacent context, not a primary source: [[2026-04-19-karpathy-llm-wiki-gist]] — "LLM is the programmer, human is the curator" framing applies here too, in the coding domain rather than the wiki domain)
