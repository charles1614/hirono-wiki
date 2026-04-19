---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# LLM-maintained Knowledge Base

A knowledge system where the LLM — not the human — does the writing, cross-linking, summarization, and consistency-maintenance. The human curates sources, directs exploration, and asks questions. The wiki is a **persistent, compounding artifact** that gets richer with every source ingested and every query answered.

## Current understanding

The pattern, per [[2026-04-19-karpathy-llm-wiki-gist]]:

- **Three layers**: raw sources (immutable) / wiki (LLM-owned markdown) / schema (governance doc).
- **Three operations**: ingest (new source → touches ~10-15 wiki pages), query (synthesize from wiki; file good answers back), lint (periodic health check for contradictions/orphans/stale claims).
- **Compounding loop**: a query that produces a good synthesis gets filed back into the wiki as a new page, so explorations accrete.
- **Why this works where personal wikis historically failed**: the maintenance cost that humans abandon is near-zero for LLMs.

Contrast with [[RAG]]: RAG retrieves raw fragments at query time; the wiki has already compiled them into durable cross-linked pages.

## Open threads

- Scaling limits: [[Karpathy]] suggests `index.md` suffices up to "~100 sources, ~hundreds of pages." At 500+ we likely need proper search ([[qmd]]) or sharded indexes.
- How autonomous should ingestion be? Supervised-one-at-a-time gives the human full control; batch-ingest scales but risks convention drift without a strong schema.
- What makes a good schema? Too loose → LLM writes inconsistently; too tight → whole-wiki rewrites when the schema changes.
- Lint cadence: per ingest, weekly, on-demand? The Karpathy gist is under-specified here.

## Sources drawn on

- [[2026-04-19-karpathy-llm-wiki-gist]] — the originating pattern, three-layer architecture, three operations, why-this-works argument
