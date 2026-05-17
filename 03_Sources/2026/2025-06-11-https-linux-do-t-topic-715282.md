---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://linux.do/t/topic/715282
tags: [inference, tooling, production-deployment]
---

# [2025-06-11] RaycastAI-Proxy：将Raycast AI接入自定义LLM API

## TL;DR

A short Linux.do thread documenting how to self-host `raycast-ai-openrouter-proxy` via Docker to route Raycast's built-in AI feature through any OpenAI-compatible endpoint, with a Docker Compose config, model JSON configuration, and screenshots of the working setup.

## Key claims

- The project `raycast-ai-openrouter-proxy` (GitHub: miikkaylisiurunen) proxies Raycast's official AI feature to any OpenAI-compatible API; the author configured it against Volcengine's Ark endpoint (`ark.cn-beijing.volces.com/api/v3`) with models like `Doubao-1.5-vision-pro-32k` (vision + tools) and `DeepSeek-V3-0324`.
- The Docker Compose setup binds port `11435:3000`; configuration is via a `models.json` file and `.env` with `API_KEY` and `BASE_URL`; starting with `docker compose up -d`.
- Raycast is configured by pointing to the local port and clicking "sync models"; MCP support is available in Raycast AI but was not tested by the author.
- On 2025-06-11, Raycast released BYOK (Bring Your Own Key) support for OpenAI, Google, and Claude, making proxy approaches partially redundant for those providers.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[Claude]]

## Topics touched

[[AI Coding Workflows]]

## Raw source

[linux.do/t/topic/715282](https://linux.do/t/topic/715282) — Linux.do forum thread (7 posts, 629 views), posted by @wren, 2025-06-11. Read 2026-05-16.
