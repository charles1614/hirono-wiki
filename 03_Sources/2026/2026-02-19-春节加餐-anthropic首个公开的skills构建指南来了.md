---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/PcyKi5q8zT-tJ_9rzgKSqg
tags: [post-training, agent-frameworks]
---

# [2026-02-19] 春节加餐：Anthropic首个公开的Skills构建指南来了！

## TL;DR
Anthropic's 32-page official guide introduces Skills for Claude: reusable, folder-based instruction packages that load progressively (YAML frontmatter always-on at ~100 tokens → SKILL.md body on-demand → scripts/references on-demand), enabling "teach once, benefit every time" workflows without bloating the context window.

## Key claims
- A Skill is a folder with a mandatory `SKILL.md` file (case-sensitive, kebab-case folder name); optional `scripts/`, `references/`, and `assets/` subdirectories load on-demand.- The YAML frontmatter layer (~100 tokens) stays resident in the system prompt at all times; only `name` and `description` fields are required.- [[Anthropic]] targets 90% auto-trigger accuracy — failure to hit this is almost always a `description` authoring problem, not a model limitation.- Five canonical workflow patterns: Sequential orchestration, Multi-MCP coordination, Iterative optimization, Context-aware tool selection, Domain-specific intelligence (compliance-first).- Three primary application archetypes: document generation (no external tools), workflow automation (multi-step with validation gates), and MCP-augmented (Skills encode how to use tools, MCP provides the tools).- Anthropic recommends iterating on a task in free-form conversation before extracting the successful pattern into a Skill — do not write Skills blind.- Instructions must be concrete and executable: include exact commands, expected outputs, error handling, and external resource references.
## Visual observations
*2 local images: weixin-img-001.png (guide cover/screenshot) and weixin-img-002.jpg (social share card). Neither carries load-bearing data.*

## What this changes
Skills formalize what was previously done via system-prompt engineering — wrapping domain knowledge + workflow logic into a versioned, modular unit. The progressive-disclosure design (3-layer load) is the key architectural insight: keeps inactive Skills near-zero-cost in the context window.

## Entities touched
[[Anthropic]]

## Topics touched
[[Agentic AI Infrastructure]]

## Raw source
[mp.weixin.qq.com/2026-02-19-春节加餐-anthropic首个公开的skills构建指南来了](https://mp.weixin.qq.com/s/PcyKi5q8zT-tJ_9rzgKSqg) — WeChat公众号 "Datawhale", published 2026-02-19. Read 2026-05-15.
