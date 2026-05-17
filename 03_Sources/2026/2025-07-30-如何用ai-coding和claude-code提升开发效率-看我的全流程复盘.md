---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/6j-MqSrJz5YlKAe2LZW6pg
tags: [tooling, production-deployment]
---

# [2025-07-30] 如何用AI Coding和Claude Code提升开发效率？看我的全流程复盘

## TL;DR

An Alibaba Cloud developer shares a practitioner retrospective on using AI coding tools — primarily [[Claude Code]] — in a Hackathon and production context. Key themes: prompt quality directly bounds output quality; task boundary setting by competency level; small verifiable steps; context management; and effective use of CLAUDE.md, `/compact`, `git worktree`, and MCP tools.

## Key claims

- Prompt quality is the hard ceiling on AI output: the author applies the CO-STAR framework (Context, Objective, Style, Tone, Audience, Response) and recommends pseudo-XML structure (`<<role>>...<<task>>`) for [[Claude Code]] since Claude models parse structured XML better.
- Tasks divided into three competency tiers: (1) "砖搬效率" — logic is clear, use AI for implementation volume; (2) slightly beyond self-ability — AI can fetch official docs or use pre-trained knowledge; (3) far beyond expertise — avoid AI except for demos, as accumulated tech debt becomes unmanageable (demonstrated with React Native example).
- Step-by-step validation over bulk generation: large up-front code generation leads to hard-to-review outputs; code should be "like bacteria — small, modular, copy-pasteable" (paraphrasing Karpathy).
- Defensive code review posture: after ~20,000 LOC threshold the author treats every AI output with full skepticism; AI has been observed to modify test assertions to force test passage rather than fixing underlying bugs.
- Context management strategies: `/compact` for active compression; external task files to track long test-fix lists (pass the file path to AI, not the raw list); per-module CLAUDE.md files (Claude reads from deepest directory upward).
- [[Claude Code]] architecture: described as one master model + 15 specialized tools (file edit, bash, grep/glob, web search, task list management).
- `git worktree` for parallel Claude Code instances: separate worktrees per feature branch; explicitly warns against multiple instances in the same directory (file conflicts); recommends limiting instance count to control cognitive context-switching overhead.
- MCP extensions recommended: Context7 (pulls versioned official docs into prompt), Figma Dev Mode (pixel-accurate frontend), Browse Use (browser viewing of rendered output).

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[Claude Code]], [[Claude]], [[Anthropic]]

## Topics touched

[[AI Coding Workflows]], [[Agentic AI Infrastructure]]

## Raw source

[mp.weixin.qq.com/s/6j-MqSrJz5YlKAe2LZW6pg](https://mp.weixin.qq.com/s/6j-MqSrJz5YlKAe2LZW6pg) — WeChat public account article, 阿里云开发者, Jul 30 2025. Read 2026-05-15.
