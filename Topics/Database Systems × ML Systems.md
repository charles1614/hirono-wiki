---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 5
---

# Database Systems × ML Systems

## What

Cross-pollination of database-systems techniques (query planning, caching, eviction, replication) into LLM serving.

## Current understanding

The most direct evidence of DB-systems thinking entering LLM serving is the framing of [[2026-05-08-a-survey-of-llm-inference-systems]] itself: a comprehensive 2025 survey of vLLM, SGLang, Mooncake, and DeepFlow filed under `cs.DB` rather than `cs.AI` or `cs.LG`. The authors' thesis is that autoregressive generation creates a systems problem whose techniques — caching, eviction, scheduling, replication — are **database problems in new clothes**. Their unifying taxonomy (load prediction · adaptive mechanisms · cost reduction) maps cleanly onto classical DB optimizer concerns: selectivity estimation, runtime plan switching, and I/O cost minimization.

**KV cache management is the primary locus of cross-pollination.** The "paged memory" abstraction introduced by vLLM's PagedAttention is a direct lift from OS virtual-memory and buffer-pool management. Eviction policies for KV blocks replicate buffer replacement decisions (LRU, clock, cost-aware). Baidu's AttentionStore ([[2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度]]) makes the DB ancestry explicit: a **cluster-level block index** (analogous to a distributed buffer-pool catalog) tracks which KV block lives in which tier (HBM / DRAM / SSD) on which node, and a **cost-aware scheduler** routes requests by cache locality — exactly the join-ordering intuition that a cost-based query optimizer uses when choosing which relation to scan first. The result (6.2× TTFT reduction vs SGLang's default policy) is the empirical payoff of applying DB scheduling rigor to an inference problem.

**Disaggregated inference re-derives distributed-DB replication tradeoffs.** The prefill / decode split ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) separates read-heavy from write-heavy workloads across machine boundaries — a partition that database designers have made for decades in OLTP vs OLAP splits and primary/replica replication schemes. NVIDIA's systematic study confirms what DB researchers long knew: the right partition depends on workload shape (prefill-heavy vs decode-heavy), not on a fixed architecture. The analogue to **dynamic rate matching** (adjusting the Ctx:Gen GPU ratio at runtime) is adaptive replication lag management in distributed databases, where read-replica count adjusts under read-load spikes.

**Analytical query processing patterns have been imported on the observability side.** The DuckDB-backed agent-trace pipeline ([[2026-04-01-openclaw-observability-基于-duckdb-构建-open]]) rests on an explicit premise: agent traces are **OLAP workloads** (time-window scans, group-by aggregation, JSON-payload extraction) and should be stored in a columnar engine, not a row-oriented one. The 6×–56× speedup of DuckDB over SQLite on the five canonical observability query shapes is a direct measurement of the cost a row-store pays for analytical access patterns. The architecture (Memory Buffer → Async Queue → Batch Flush → columnar store) mirrors stream-processing ingestion pipelines in analytical databases.

**Where sources agree:** the DB-system analogy holds most tightly for memory management (tiered cache, eviction, buffer pools) and scheduling (locality-aware routing, cost-based plan selection). These are the highest-value transfer points, and all corpus sources that engage with KV cache design have independently converged on the same tiered-storage + cache-locality-routing pattern.

**Where the analogy has limits (emerging, not yet well-sourced):** database query optimization assumes stable schema and statistics; LLM request shapes are highly variable and model-dependent. Classical eviction policies assume uniform access cost; KV cache blocks have variable recompute cost depending on sequence length and layer position. The survey's "open challenges" section is not yet ingested in the corpus — that would be the place to find where the DB framing breaks down. The 大模型推理八股 TOC ([[2026-04-26-大模型推理八股-小红书]]) lists "memory-bandwidth bottleneck" and "Roofline Model" as foundational — these are hardware-physics constraints that DB-system techniques can optimize around but cannot eliminate, which is the binding constraint the analogy cannot paper over.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
