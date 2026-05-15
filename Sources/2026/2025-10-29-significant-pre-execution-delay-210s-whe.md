---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/anthropics/claude-code/issues/4049
tags: [inference, tooling]
---

# [2025-07-21] Significant Pre-Execution Delay (~210s) When Calling Bash Tool on Windows · Issue #4049 · anthropics/claude-code

## TL;DR

Claude Code on Windows (and some macOS Bedrock setups) showed ~210-second hangs before any Bash command executed. Root cause: a pre-flight Haiku API call failing with 403 AccessDeniedException when the user's AWS Bedrock account lacked model-access permissions for Haiku 3.5. Enabling Bedrock model access resolved it immediately.

## Key claims

- Every `Bash()` invocation triggered a silent pre-flight check against the configured `ANTHROPIC_SMALL_FAST_MODEL` (defaulting to Haiku); a 403 from Bedrock caused a ~210-second retry/timeout before the permission prompt appeared.
- The issue was diagnosed by running `ANTHROPIC_LOG=debug` and observing `AccessDeniedException` on `us.anthropic.claude-3-5-haiku-20241022-v1:0` in Bedrock.
- Reproducing: occurred on Windows 10/11 with Git Bash and on macOS Sequoia 15.5 when using Bedrock as provider.
- Fix: enable model access for Haiku 3.5 in AWS Bedrock console; alternatively set `ANTHROPIC_SMALL_FAST_MODEL` to a model already permitted.
- A helpful log message was added to [[Claude Code]] to surface this timeout root cause in future occurrences.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[Claude Code]], [[Anthropic]]

## Topics touched

[[Agentic AI Infrastructure]]

## Raw source

[github.com/anthropics/claude-code/issues/4049](https://github.com/anthropics/claude-code/issues/4049) — GitHub issue, opened Jul 21 2025, closed Jul 22 2025. Read 2026-05-15.
