---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/tak-bro/aicommit2/tree/main
tags: [tooling]
---

# [2025-06-09] aicommit2: Reactive CLI for AI-Generated Git Commit Messages

## TL;DR

[[aicommit2]] is an open-source CLI tool (npm/Homebrew) that uses multiple LLM providers to automatically generate git commit messages from staged diffs. It supports Git, YADM, and Jujutsu repositories, integrates with LazyGit and git hooks, and allows parallel querying of multiple AI backends simultaneously.

## Key claims

- Supports a wide range of AI providers: OpenAI, Anthropic Claude, Google Gemini, Mistral, Cohere, Groq, Ollama (local), and any OpenAI API-compatible service.
- Works with three VCS systems: Git, YADM (dotfiles manager), and Jujutsu (jj) with automatic detection.
- Key features include diff compression to fit large diffs in context windows, a custom prompt template system, a code review mode, a "watch commit mode" for automatic message generation on each commit, and configurable logging.
- Setup is via an interactive wizard (`aicommit2 setup`) or manual config (`aicommit2 config set OPENAI.key=<key>`); installable via `brew install aicommit2` or `npm install -g aicommit2`.
- Inspired by AICommits (Nutlope); built reactively to support streaming and parallel responses from multiple providers simultaneously.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[aicommit2]]

## Topics touched

[[AI Coding Workflows]]

## Raw source

[github.com/tak-bro/aicommit2/tree/main](https://github.com/tak-bro/aicommit2/tree/main) — GitHub README by tak-bro. Read 2026-05-16.
