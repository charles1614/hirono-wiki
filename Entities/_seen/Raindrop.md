---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-20'
type: entity
refs: 2
tier: seen
---

# Raindrop

Raindrop.io — the bookmark-management service this wiki uses as a primary raw-source layer. 579 bookmarks, 41 with highlights. The canonical "I saved this, do something with it later" input queue.

## Synthesis

Thin (1 source). In this wiki's architecture Raindrop plays the role [[Obsidian]]'s Web Clipper plays in [[Karpathy]]'s original method — the capture surface that feeds the raw-sources layer. Raindrop's official [[MCP]] server (`https://api.raindrop.io/rest/v2/ai/mcp`) exposes `find_bookmarks`, `fetch_bookmark_content`, and highlight/collection/tag queries. Per user instruction the folder-classification in Raindrop is **not trusted** — tags and highlights may inform priority, but the wiki re-classifies from content.

## Observations

- Raindrop hosts an official MCP server that surfaces bookmarks, content, highlights, collections, and tags to LLM agents. — [[2026-04-20-anthropic-teams-use-claude-code]]
