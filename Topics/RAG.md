---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# RAG

Retrieval-Augmented Generation. At query time, retrieve relevant chunks from a collection of documents (usually via embeddings + vector search) and feed them as context into an LLM to generate an answer.

## Current understanding

Thin (1 source). Positioned in [[2026-04-19-karpathy-llm-wiki-gist]] as the contrast class for [[LLM-maintained Knowledge Base|LLM wikis]]:

- RAG: rediscovers knowledge on every query; no accumulation between questions. NotebookLM, ChatGPT file upload, most "talk to your docs" products.
- LLM wiki: compiles knowledge once into a persistent, cross-linked artifact; cross-references pre-resolved.

The distinction is consequential for synthesis questions. If a question requires combining five documents, RAG re-finds them every time; the wiki already has the synthesis on a page.

## Open threads

- Where's the sweet spot? Small personal collections favor wikis; huge corpora (millions of docs) favor RAG. Karpathy puts the wiki sweet spot at "~100 sources, ~hundreds of pages." Beyond that, what hybrid looks right?
- Can the wiki pattern + [[qmd]]-style hybrid search be a durable replacement for RAG, or does it top out somewhere?

## Sources drawn on

- [[2026-04-19-karpathy-llm-wiki-gist]] — RAG framed as the contrast class to LLM-maintained wikis
