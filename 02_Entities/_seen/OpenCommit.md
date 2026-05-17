---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 2
tier: seen
---

# OpenCommit

LLM-powered git commit message generator CLI tool

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Open-source CLI tool (`oco`) that generates git commit messages using LLMs in ~2 seconds; supports OpenAI, Anthropic, Ollama, DeepSeek, Gemini, and other providers; won GitHub 2023 Hackathon; configurable per-repo via `.env` or globally via `~/.opencommit`. — [[2025-06-09-di-sukharev-opencommit-gpt-wrapper-for-g]]
- Key config options: `OCO_MODEL` (default `gpt-4o-mini`), `OCO_EMOJI`, `OCO_DESCRIPTION`, `OCO_ONE_LINE_COMMIT`, `OCO_PROMPT_MODULE` (conventional-commit or @commitlint); `--yes` flag skips confirmation; `--fgm` enables full GitMoji spec. — [[2025-06-09-di-sukharev-opencommit-gpt-wrapper-for-g]]
