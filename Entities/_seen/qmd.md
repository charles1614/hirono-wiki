---
created: 2026-04-19
updated: 2026-04-19
type: entity
refs: 1
tier: seen
---

# qmd

A local search engine for markdown collections. Hybrid BM25 + vector retrieval with LLM re-ranking, all on-device. Ships both a CLI and an MCP server.

## Synthesis

Thin (1 source). Recommended by [[Karpathy]] for wikis that outgrow index-based navigation (beyond ~100 sources / hundreds of pages). Not yet in use here; the three-sharded index pattern in [[Meta/index]] is Plan A.

## Observations

- Hybrid BM25 + vector + LLM re-rank; on-device; CLI + MCP server. Recommended when `index.md` alone stops scaling. — [[2026-04-19-karpathy-llm-wiki-gist]]
- Repo: https://github.com/tobi/qmd
