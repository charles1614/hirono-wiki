---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/di-sukharev/opencommit
tags: [tooling, inference]
---

# [2025-06-09] OpenCommit: GPT Wrapper for Git — LLM Commit Message Generator

## TL;DR

OpenCommit is an open-source CLI tool (`oco`) that auto-generates meaningful git commit messages using LLMs in under 2 seconds. It supports OpenAI, Anthropic, Azure, Ollama, Gemini, DeepSeek, and other providers, and won the GitHub 2023 Hackathon.

## Key claims

- Install globally via `npm install -g opencommit`, set `OCO_API_KEY`, then run `oco` on staged changes to generate a commit message with one command.
- Supports local models via [[Ollama]] (`oco config set OCO_AI_PROVIDER='ollama' OCO_MODEL='llama3:8b'`); for remote Ollama endpoints configure `OCO_API_URL`.
- Default model is `gpt-4o-mini`; all major LLM providers supported including Anthropic, DeepSeek, and local Ollama models.
- Configurable per-repo via `.env` or globally via `~/.opencommit`; key options: `OCO_MODEL`, `OCO_EMOJI`, `OCO_DESCRIPTION`, `OCO_ONE_LINE_COMMIT`, `OCO_PROMPT_MODULE` (conventional-commit or @commitlint).
- `--yes` flag skips confirmation; `--fgm` enables full GitMoji spec (otherwise limited to 10 emojis to reduce token cost).
- All commits in the opencommit repo itself were authored by the tool — used as a live demonstration of quality.
- Git pre-commit hook integration available: `oco hook set` installs it; every `git commit` then triggers auto-generation.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[OpenCommit]]

## Topics touched

[[AI Coding Workflows]]

## Raw source

[github.com/di-sukharev/opencommit](https://github.com/di-sukharev/opencommit) — GitHub README, open-source tool by di-sukharev. Read 2026-05-16.
