---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://linux.do/t/topic/760680/4
tags: [inference, tooling, production-deployment]
---

# [2025-07-02] 实现Claude Code自由：一键部署的Docker化claude-code-proxy解决方案

## TL;DR

A Linux.do community thread sharing a Dockerized proxy (`lie5860/claude-code-proxy`) that routes [[Claude Code]]'s Anthropic API calls to any OpenAI-compatible endpoint, enabling use of models like Gemini 2.5 Pro or GPT-4o-mini as drop-in substitutes via environment variable configuration.

## Key claims

- The proxy is based on `fuergaosi233/claude-code-proxy` and packaged as a multi-arch Docker image (`amd64`, `arm64`), deployable with a single `docker run` command setting `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `BIG_MODEL`, and `SMALL_MODEL` env vars.
- Claude Code uses a large model for complex tasks and a small model for frequent requests; the proxy maps these to separate upstream endpoints, e.g., `gemini-2.5-pro` (large) and `gpt-4o-mini` (small) from community public API pools.
- Users configure Claude Code by pointing `ANTHROPIC_BASE_URL` to the local proxy (e.g., `http://127.0.0.1:8082`) and setting an arbitrary `ANTHROPIC_API_KEY`; an initialization bash script automates this for macOS.
- A subsequent update (7.21) added auto-sync from upstream and a CCR mirror; a companion docker-based `claude-code-router` project was also released.
- Community discussion identified RPM limits as a concern; using unlimited-RPM public OpenAI keys or self-managed `new-api` aggregators was recommended as a mitigation.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[Claude Code]]

## Topics touched

[[AI Coding Workflows]]

## Raw source

[linux.do/t/topic/760680/4](https://linux.do/t/topic/760680/4) — Linux.do forum thread (128 posts, 9893 views), posted by lie5860 (Zhihong Huang), 2025-07-02. Read 2026-05-16.
