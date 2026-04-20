---
created: 2026-04-19
updated: 2026-04-19
type: source
raw_source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
tags: [wiki, llm-tooling, knowledge-management, method]
---

# [2026-04-19] Karpathy's LLM Wiki pattern (GitHub gist)

## TL;DR

[[Karpathy]] proposes using an LLM to incrementally build and maintain a personal markdown wiki that sits between you and your raw sources. Unlike [[RAG]] — which rediscovers knowledge every query — the wiki is a **persistent, compounding artifact**: summaries, entity pages, cross-references, and synthesis accrete over time. The LLM does the bookkeeping (the tedious part that makes humans abandon wikis); the human curates sources and asks questions. Architecture is three layers: raw sources (immutable) → wiki (LLM-owned markdown) → schema (governance doc).

## Key claims

- The core move: don't just retrieve from raw documents at query time — **compile knowledge into a persistent wiki once, then keep it current.** Cross-references and contradictions are pre-resolved.
- The wiki is exclusively LLM-written. The human's job is sourcing, exploration, and asking good questions. Division of labor: "[[Obsidian]] is the IDE; the LLM is the programmer; the wiki is the codebase."
- Three-layer architecture: **Raw sources** (immutable) · **Wiki** (LLM-owned MD files) · **Schema** (a governance doc like CLAUDE.md / AGENTS.md).
- Three operations: **Ingest** (process a new source, touch 10–15 pages), **Query** (synthesize from wiki pages, file good answers back as new pages), **Lint** (health check: contradictions, orphans, stale claims, missing cross-refs).
- **Good answers should be filed back into the wiki.** Explorations compound just like ingested sources — otherwise they evaporate into chat history.
- Two special navigation files: `index.md` (content-oriented catalog; regenerated on ingest) and `log.md` (chronological append-only; parseable if entries follow a prefix like `## [YYYY-MM-DD] ingest | Title`).
- At moderate scale (~100 sources, hundreds of pages) the `index.md` approach works without embedding-based [[RAG]] infrastructure. Only needs proper search at scale; recommended tool: [[qmd]] (BM25 + vector hybrid + LLM re-rank, on-device).
- The wiki is a git repo — version history, branches, collaboration for free.
- Why this works: LLMs don't get bored of bookkeeping. Humans abandon wikis because maintenance cost grows faster than value; with LLMs, maintenance cost is near zero.
- Predecessor idea: Vannevar Bush's [[Memex]] (1945) — a personal curated knowledge store with associative trails. Bush couldn't solve "who does the maintenance"; the LLM does.

## Entities touched

[[Karpathy]], [[Obsidian]], [[qmd]], [[Memex]]

## Topics touched

[[LLM-maintained Knowledge Base]], [[RAG]]

## Open questions

- Karpathy suggests index.md suffices up to "~100 sources, ~hundreds of pages" — where exactly does that ceiling bite? My own wiki plans for 579 Raindrop bookmarks + ~100 Space 1 nodes, which pushes past that threshold.
- What's the right linting cadence? "Periodically" is under-specified. Per ingest? Weekly? On-demand?
- How should the schema evolve without causing whole-wiki rewrites? Every schema edit is a potential mass-refactor of existing pages.
- The document emphasizes Obsidian for the graph view + hotkeys + plugin ecosystem. What's lost going Lark-first (as I'm doing)? See cross-refs in [[schema]].
- "File good answers back into the wiki" is the compounding move. How does the LLM decide what's worth filing vs not?

## Raw source

- URL: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Pinned revision: ac46de1ad27f92b28ac95459c782c07f6b8c964a (commit at ingest time)
- Fetched 2026-04-19 via `curl` (WebFetch declined verbatim reproduction on content-policy grounds; curl gave the raw markdown cleanly)
- Length: 75 lines of markdown
