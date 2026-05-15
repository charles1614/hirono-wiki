---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/anthropics/claude-code/issues/4002#issuecomment-3276557870
tags: [tooling, production-deployment]
---

# [2025-07-20] Error: File content (28375 tokens) exceeds maximum allowed tokens (25000) · Issue #4002 · anthropics/claude-code

## TL;DR

GitHub issue thread on Claude Code's 25,000-token per-read limit, which many users find too restrictive given 200K model context windows. Anthropic contributor explains the limit is intentional to prevent single long-file reads from consuming the entire context and triggering compaction; MCP output limits are separately configurable via `MAX_MCP_OUTPUT_TOKENS`.

## Key claims

- Claude Code enforces a 25,000-token hard limit on file reads, triggering `Error: File content (N tokens) exceeds maximum allowed tokens (25000)`.
- The limit applies both to file reads and MCP tool responses; MCP limit is separately configurable via `export MAX_MCP_OUTPUT_TOKENS=50000`.
- Anthropic contributor (catherinewu) confirmed the limit is intentional: without it Claude Code sometimes reads very long files that fill the entire context window, causing compaction that frustrates users.
- The model can still read an entire large file by issuing multiple reads with different `offset`/`limit` parameters.
- Community workaround: `sed -i 's/25000/100000/g' ~/.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js`.
- Windows environment variable `CLAUDE_CODE_MAX_OUTPUT_TOKENS` can raise the file read limit.
- Issue closed Dec 2, 2025; labels: `enhancement`, `area:tools`, `area:core`.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

Documents the rationale and workarounds for Claude Code's read token limit — useful context for users hitting the limit with large files or verbose MCP tool responses.

## Entities touched

[[Claude Code]], [[Anthropic]]

## Topics touched

## Raw source

[github.com/anthropics/claude-code/issues/4002](https://github.com/anthropics/claude-code/issues/4002#issuecomment-3276557870) — GitHub issue thread, opened Jul 20, 2025, closed Dec 2, 2025. Read 2026-05-15.
