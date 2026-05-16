---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://linux.do/t/topic/761806
tags: [agentic-coding, developer-tools, community]
---

# [2025-07-02] 平平无奇 — TBAI Claude Code 实现自由 (linux.do)

## TL;DR

The original linux.do thread by Tingxifa sharing a Bash script that routes Claude Code to any OpenAI-compatible proxy (tbai.xin default) by patching `~/.claude/settings.json`, with the internal `HAIKU` budget model hard-coded to a community-shared gpt-4o-mini key via TBAI.

## Key claims

- Script is a single Bash file; sets `ANTHROPIC_BASE_URL` to `https://claude-code-proxy.suixifa.workers.dev` and a user-supplied TBAI API key; hardcodes HAIKU internal calls to a shared gpt-4o-mini endpoint.
- Uses `jq` for JSON editing if available; falls back to Python 3; last resort is raw heredoc overwrite.
- Author acknowledges the claude_proxy used Cloudflare Workers as a relay, with source code available on GitHub.
- Community discussion confirms the script runs on macOS; Windows users need to manually adapt the Bash script; `~/.claude/settings.json` can also be edited directly.
- This thread preceded topic/762693 ("平权计划") which introduced a more configurable version.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Claude Code]]

## Topics touched

[[LLM API Proxying]], [[AI Coding Workflows]]

## Raw source

[linux.do/t/topic/761806](https://linux.do/t/topic/761806) — linux.do community thread, @Ling_Anthony, 2025-07-02. Read 2026-05-16.
