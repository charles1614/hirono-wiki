---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://linux.do/t/topic/762693
tags: [agentic-coding, developer-tools, community]
---

# [2025-07-03] Claude Code 平权计划 — API Proxy Configuration Tool (linux.do)

## TL;DR

A linux.do community thread sharing `claude_proxy.sh`, a Bash script by user Tingxifa (Ling_Anthony) that installs Claude Code and configures it to use any OpenAI-compatible API endpoint (e.g. tbai.xin) by updating `~/.claude/settings.json`, enabling use of models like Gemini without a paid Anthropic subscription.

## Key claims

- Script sets `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, and `apiKeyHelper` in `~/.claude/settings.json`; automatically backs up old config before overwriting.
- Supports `jq` or `python3` for JSON manipulation; falls back to raw `cat` heredoc if neither is found.
- Thread references tbai.xin as the public proxy endpoint (`tbai.xin/v1`); community confirms Gemini-2.5-Pro works through the proxy, though model behavior differences from native Claude were noted.
- Upstream Cloudflare Worker proxy (`claude-code-proxy.suixifa.workers.dev`) source code available on GitHub.
- Thread predecessor is the companion post "平平无奇-TBAI_claude code 实现自由" (topic/761806) with the original simpler script.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Claude Code]]

## Topics touched

[[LLM API Proxying]], [[AI Coding Workflows]]

## Raw source

[linux.do/t/topic/762693](https://linux.do/t/topic/762693) — linux.do community thread, @Ling_Anthony, 2025-07-03. Read 2026-05-16.
