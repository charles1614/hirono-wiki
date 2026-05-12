---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://mp.weixin.qq.com/s/<openclaw-obs-shortlink>
tags: [observability, tooling]
---

# [2026-04-01] OpenClaw-Observability：基于 DuckDB 构建 OpenClaw 的全链路可观测体系

## TL;DR

A weixin post describing **OpenClaw-Observability** — a four-layer end-to-end observability framework for an OpenClaw-style AI coding agent, built on **DuckDB** as the embedded analytics store. The system hooks into 4 event classes at the agent runtime (Session/Message · Tool-call before/after · LLM Thinking/Response · Run/Subtask switching) and writes structured trace records to a local DuckDB instance, with an optional async upload to a cloud RDS-MySQL-DuckDB aggregation tier. **DuckDB is the load-bearing engineering bet**: benchmark table shows 6×-56× speedup over SQLite across 5 query types (group-by, time-range, JSON-field, top-sessions, full-text). The architecture is the more durable contribution than the OpenClaw-specific framing — it generalizes to any agent-runtime trace-pipeline that wants OLAP without a separate analytics database.

## Key claims

**Four-layer architecture** (top to bottom):

1. **Collection Layer** — 4 event-class hooks into the agent runtime: Session Start / Message Entered · Before/After Tool Call · LLM Thinking / Response · Run / Subtask Switching. The plugin captures **20 hooks** total, with a `capture → redact → buffer` pipeline (PII redaction before storage is built-in).
2. **Modeling Layer** — adds TraceID / ParentID / Run-Lineage + Observation-Type classification to each event. Tree-structured per session.
3. **Storage Layer** — Memory Buffer → Async Queue → Batch Flush to DB. Writes go through DuckDB tables `audit_actions` + `audit_sessions` + `audit_alerts`.
4. **Visualization & Analysis Layer** — three views: Trace, Analytics, Security.

**DuckDB benchmark vs SQLite** (the load-bearing choice justification):

| Query | SQLite | DuckDB | Speedup |
|---|---|---|---|
| GROUP BY Aggregation | 201 ms | 5 ms | **40×** |
| Time-Range + Aggregation | 168 ms | 3 ms | **56×** |
| JSON Field Extraction | 349 ms | 24 ms | **14.5×** |
| Top Sessions (Sort) | 118 ms | 3 ms | **39×** |
| LIKE Full-Text Search | 155 ms | 26 ms | **6×** |

DuckDB's columnar + vectorized execution dominates for the analytical-query shape that observability queries take (group-by, time-window, JSON-payload extraction). SQLite is row-oriented and pays the OLAP penalty. For agent-trace workloads — read-mostly + heavy aggregation — DuckDB is the obvious match.

**Security pipeline** runs inline before DB write:

- **L1 Regex** — fast pattern-based detection (credentials, PII, suspicious URLs).
- **L2 Behavior Chain** — multi-event sequence detection (e.g. "user → LLM → tool-call that exfiltrates the prior response").

Both run synchronously in the capture path so alerts land in `audit_alerts` at the same time as the underlying action.

**Local + cloud deployment topology**:

- **Local zone**: OpenClaw Gateway → Observability Plugin (20 Hooks) → Security Scanner → DuckDB → Analytics Dashboard. Self-contained.
- **Cloud zone** (optional): Async upload from local DuckDB → RDS-MySQL-DuckDB analytics tier. Unified Admin Interface aggregates across multiple local instances.

The upload edge is dashed in the architecture diagram — explicitly optional, intended for fleet-wide aggregation when the operator wants cross-session insights.

**The trace-viewer UI** (visible in the dashboard screenshot) renders sessions as Gantt-style timelines with per-action drill-down: `llm_calls` + `thinking` + `assistant_stream` sub-bars for each LLM-mediated action. Right-pane shows OUTPUT + INSIGHT panels for the selected trace. Example session in the screenshot: a shoe-ordering interaction with Axie (10 actions over 2 minutes).

## Visual observations

**Four-layer observability architecture** (`../../raw/raindrop/mp.weixin.qq.com/2026-04-01-openclaw-observability-基于-duckdb-构建-open/weixin-img-003.png`)

![Four-layer observability architecture: Collection Layer (Session/Message/Tool-call/Run hooks) → Modeling Layer (TraceID/ParentID + Observation Type) → Storage Layer (Memory Buffer → Async Queue → Batch Flush → DuckDB) → Visualization Layer (Trace / Analytics / Security views)](../../raw/raindrop/mp.weixin.qq.com/2026-04-01-openclaw-observability-基于-duckdb-构建-open/weixin-img-003.png)

The 4-layer separation is the architectural commitment — hooks register events at runtime; modeling assigns structure; storage uses DuckDB-friendly batched async writes; visualization is independent. Each layer has a clean contract.

**DuckDB vs SQLite benchmark** (`../../raw/raindrop/mp.weixin.qq.com/2026-04-01-openclaw-observability-基于-duckdb-构建-open/weixin-img-005.png`)

![DuckDB vs SQLite query-time benchmark: 5 query types (GROUP BY, time-range agg, JSON extraction, top-sessions, LIKE full-text) with 6×–56× speedup for DuckDB](../../raw/raindrop/mp.weixin.qq.com/2026-04-01-openclaw-observability-基于-duckdb-构建-open/weixin-img-005.png)

The benchmark table — load-bearing because the 6×-56× DuckDB advantage is the architectural justification for the entire stack. Without this gap, SQLite (the default embedded DB) would be the simpler choice.

**Local + Cloud deployment architecture** (`../../raw/raindrop/mp.weixin.qq.com/2026-04-01-openclaw-observability-基于-duckdb-构建-open/weixin-img-006.png`)

![Two-zone deployment: Local (OpenClaw Gateway → Observability Plugin 20 hooks → Security Scanner L1 regex + L2 behavior chain → DuckDB audit_actions/sessions/alerts → Analytics Dashboard) with dashed-arrow upload edge to Cloud (RDS-MySQL-DuckDB → Unified Admin Analytics Dashboard)](../../raw/raindrop/mp.weixin.qq.com/2026-04-01-openclaw-observability-基于-duckdb-构建-open/weixin-img-006.png)

The deployment topology — local self-contained DuckDB instance + optional fleet-aggregation via cloud RDS-MySQL-DuckDB. The dashed upload edge is the architectural commitment: each local agent is self-sufficient; cloud aggregation is an opt-in convenience.

## What this changes

A **DuckDB-as-agent-trace-store** reference design. The wiki has been collecting observability Sources ([[2025-11-17-feature-sglang-tracing-fine-grained-trac]] SGLang OTel-tracing; [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] vLLM Prometheus); this is the agent-side variant. The architectural lesson: **agent traces are OLAP workloads, not OLTP** — row-oriented stores (SQLite, MySQL) pay a 10-50× penalty on the queries operators actually run (per-session aggregation, time-window scans, JSON-payload extraction).

Cross-pollination with the harness-engineering theme ([[2026-04-29-welcome-to-learn-harness-engineering-lea]]): observability is the verify side of the harness — every action has a TraceID, the harness's `claude-progress.md` is durable agent-state, this Source is the durable agent-trace. They compose into an auditable agent runtime.

## Raw source

> Platform: weixin · Subject: OpenClaw-Observability framework writeup
> Architecture: 4-layer (Collection / Modeling / Storage / Visualization), DuckDB-backed
> Hooks: 20 instrumentation points across the agent runtime
> Tables: `audit_actions` / `audit_sessions` / `audit_alerts`
> Image extraction: Sonnet subagent pass; see `<slug>-images-extract.md` sibling
> Related corpus: [[2025-11-17-feature-sglang-tracing-fine-grained-trac]], [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]], [[2026-04-29-welcome-to-learn-harness-engineering-lea]]
