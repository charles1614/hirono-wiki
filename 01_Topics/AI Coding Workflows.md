---
created: 2026-05-15
updated: 2026-05-16
type: topic
source_count: 11
---

# AI Coding Workflows

## What

developer workflows and best practices for using LLM-powered coding tools effectively

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Observations

- [[OpenCommit]] (`oco`) auto-generates git commit messages via LLMs in ~2 seconds; supports OpenAI, Anthropic, Ollama, DeepSeek, and other providers; configurable model, emoji, commit format (conventional-commit / @commitlint); `--yes` flag skips confirmation for automation; git pre-commit hook integration available. — [[2025-06-09-di-sukharev-opencommit-gpt-wrapper-for-g]]
- [[aicommit2]] is a Reactive CLI that queries multiple LLM providers in parallel to generate git commit messages; supports Git, YADM, and Jujutsu with auto-detection; features include diff compression, custom prompt templates, code review mode, watch-commit mode, and LazyGit integration. — [[2025-06-09-tak-bro-aicommit2-a-reactive-cli-that-ge]]
- Community pattern for running [[Claude Code]] through free/community LLM pools: proxy intercepts `ANTHROPIC_BASE_URL` and routes to OpenAI-compatible endpoints; `BIG_MODEL` (e.g., Gemini 2.5 Pro) handles complex requests, `SMALL_MODEL` (e.g., GPT-4o-mini) handles frequent lightweight requests; multi-arch Docker deployment makes this accessible without Python environment setup. — [[2025-07-02-实现claude-code自由-一键部署的docker化claude-code-]]

## Open threads

## Sources drawn on

- [[2025-07-30-如何用ai-coding和claude-code提升开发效率-看我的全流程复盘]] — Claude Code practitioner retrospective: CO-STAR prompting, task boundary by competency, git worktree parallelism, /compact context management, per-module CLAUDE.md.
- [[2025-07-23-wavetermdev-waveterm-an-open-source-cros]] — Wave Terminal: open-source AI-integrated terminal with BYOK LLM support, durable SSH, wsh CLI for workspace+file sync.
- [[2025-07-03-claude-code-平权计划-接入api-key-model-直接使用-开发]] — Community claude_proxy.sh: patching Claude Code settings.json to route through OpenAI-compatible proxy endpoints.
- [[2025-07-03-平平无奇-tbai_claude-code-实现自由-福利羊毛-linux-do]] — Earlier linux.do script: Cloudflare Worker relay pattern for free Claude Code access via community API pools.
- [[2025-07-02-实现claude-code自由-一键部署的docker化claude-code-]] — Dockerized claude-code-proxy; multi-arch; `BIG_MODEL`/`SMALL_MODEL` env-var routing to OpenAI-compatible endpoints.
- [[2025-06-11-https-linux-do-t-topic-715282]] — RaycastAI-Proxy: Docker Compose setup routing Raycast's built-in AI to custom OpenAI-compatible endpoints via models.json config.
- [[2025-06-09-https-share-google-link-https-linux-do-t]] — Cursor account sharing change (2025-04-06): website login sessions now single-user; access tokens or `curs0r` client as workarounds.
- [[2025-06-09-tak-bro-aicommit2-a-reactive-cli-that-ge]] — aicommit2 CLI: AI commit message generation supporting Git/YADM/Jujutsu, multiple LLM providers, diff compression, LazyGit integration.
- [[2026-03-26-composer]] — Composer 2 technical report: CursorBench methodology, self-summarization for long-horizon agents, RL infrastructure with Anyrun/Firecracker VMs, nonlinear length penalty rewards.
