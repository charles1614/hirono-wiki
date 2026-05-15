---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 2
---

# Serverless LLM Serving

## What

Per-request billing over shared accelerator infrastructure — a distinct design point from dedicated single/multi-replica deployments.

## Current understanding

Serverless LLM serving is a distinct deployment architecture in which **per-request billing over shared accelerator infrastructure** replaces the dedicated single- or multi-replica model. Rather than a tenant owning GPU capacity continuously, the serving layer multiplexes many workloads across a shared pool and charges only for compute consumed per inference request. This positions it as the outermost ring of a deployment topology that the survey [[2026-05-08-a-survey-of-llm-inference-systems]] describes as a progression: single-replica → multi-replica → disaggregated inference → serverless.

The design challenges that make serverless LLM serving non-trivial all stem from the same root as other inference architectures: **autoregressive generation creates highly variable and unpredictable per-request compute demand**. The three primitives that the survey identifies as universal to inference techniques — **load prediction**, **adaptive mechanisms**, and **cost reduction** — apply with particular sharpness in the serverless setting, because over-provisioning wastes shared capacity and under-provisioning causes latency spikes that are visible across many tenants simultaneously.

**KV-cache management** is especially consequential in serverless contexts. In a dedicated deployment a warm model instance retains its KV cache between requests; in a serverless setting, the instance may be cold or shared with unrelated requests, making **cache persistence** and **eviction policy** load-bearing correctness concerns rather than optional optimizations. Paged memory (the mechanism vLLM popularized) and offloading strategies become critical to achieving acceptable time-to-first-token without permanently locking GPU memory.

The corpus on this topic is thin — one survey source touches serverless as the terminal entry in a deployment taxonomy, without elaborating the specific scheduling, cold-start, or pricing-model tradeoffs that distinguish production serverless deployments. The open research questions (warm-pool sizing, preemption policies, SLA-aware batching under per-request billing) are noted in that survey's open-challenges section but not yet detailed in the wiki corpus. Claims in this entry should be treated as orientation, not settled consensus, until additional sources are drawn in.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
