---
created: 2026-05-17
updated: 2026-05-17
type: source
source_url: https://github.com/Tencent/TencentDB-Agent-Memory
tags: [inference, kv-cache, tooling, long-context, production-deployment]
---

# [2026-05-16] Tencent/TencentDB-Agent-Memory: Symbolic + Layered Agent Memory

## TL;DR

Tencent's open-source Agent memory plugin combines (1) **symbolic short-term memory** that offloads verbose tool logs to disk and keeps only a high-density Mermaid task canvas in context, and (2) **layered long-term memory** that distills raw conversations through a four-tier semantic pyramid (L0 Conversation → L1 Atom → L2 Scenario → L3 Persona). Plugs into [[OpenClaw]] and [[Hermes]]; runs zero-config on local SQLite + sqlite-vec; reported to cut WideSearch token usage by 61.38%, lift WideSearch pass rate +51.52% (relative), and raise PersonaMem accuracy from 48% → 76%.

## Key claims

- Benchmark results (continuous long-horizon sessions, not isolated turns): WideSearch short-term — 33% → 50% pass (+51.52% relative), 221.31M → 85.64M tokens (−61.38%); SWE-bench — 58.4% → 64.2% pass (+9.93%), 3474.1M → 2375.4M tokens (−33.09%) over 50 consecutive tasks per session; AA-LCR — 44.0% → 47.5% pass (+7.95%), 112.0M → 77.3M tokens (−30.98%); PersonaMem long-term accuracy — 48% → 76% (+59%). See [[TencentDB Agent Memory]], [[OpenClaw]].
- Short-term context layering has three layers: bottom = raw tool outputs persisted as `refs/*.md`; middle = step-level summaries in `jsonl`; top = lightweight Mermaid canvas. The Agent only reads the top-layer Mermaid structure in context; on error or detail-need it drills down by `node_id` via grep to retrieve raw text — bounding token cost while preserving full traceability. See [[TencentDB Agent Memory]].
- Long-term personalization pyramid: **L0 Conversation** (raw dialogue) → **L1 Atom** (atomic facts) → **L2 Scenario** (scene blocks) → **L3 Persona** (user profile). Skill-generation layering also derives Scenario patterns from L0 execution traces and distills L3-level Skills/SOPs at the top. Heterogeneous storage: lower layers in database (full-text retrieval), upper layers as human-readable Markdown files (high density + white-box inspection). See [[TencentDB Agent Memory]].
- Recall configuration: `recall.strategy` defaults to `"hybrid"` (BM25 + vector + RRF fusion), L1 extraction triggers every 5 conversation turns by default, max 20 memories extracted per L1 pass, persona regenerated every 50 new memories. Warm-up doubles the L1 trigger interval (1→2→4→...) for new sessions. Default tokenizer language `zh` (jieba). See [[TencentDB Agent Memory]].
- Context-offload trigger thresholds: mild compression at 50% of context window (`offload.mildOffloadRatio: 0.5`); aggressive compression at 85% (`offload.aggressiveCompressRatio: 0.85`); Mermaid canvas injection capped at 20% of context budget (`offload.mmdMaxTokenRatio: 0.2`). Requires version ≥ 0.3.4 and a runtime patch script (`openclaw-after-tool-call-messages.patch.sh`) that hooks after-tool-call messages to make them offload-safe. See [[TencentDB Agent Memory]], [[OpenClaw]].
- Hermes integration ships a Docker container (`Dockerfile.hermes`, port 8420 Gateway, named volume `hermes_data:/opt/data`) defaulting to Tencent Cloud LKE endpoint and DeepSeek-V3.2; supports any OpenAI-compatible endpoint via `MODEL_PROVIDER="custom"`. See [[Hermes]], [[DeepSeek-V3.2]], [[Tencent]].
- Tooling claims: `tdai_memory_search` and `tdai_conversation_search` are exposed as Agent tools. Local backend is SQLite + sqlite-vec; the OpenClaw plugin is `@tencentdb-agent-memory/memory-tencentdb` on npm. Memory artifacts live under `~/.openclaw/memory-tdai/` for direct inspection. Roadmap: cross-Agent / cross-framework / cross-device portable memory, automatic Skill generation, visual debugging dashboard. See [[TencentDB Agent Memory]], [[SQLite]].

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

- Establishes a concrete pattern for in-context memory engineering: separate symbolic top-layer (Mermaid, in-context) from raw evidence (offloaded files, recalled via `node_id`) — a deterministic drill-down chain rather than vector-store opacity. Token savings reported are large enough (61% on WideSearch, 33% on SWE-bench) to matter for cost-bound 50-task-session agent runs.

## Entities touched

[[TencentDB Agent Memory]], [[Tencent]], [[OpenClaw]], [[Hermes]], [[Nous Research]], [[DeepSeek-V3.2]], [[SQLite]]

## Topics touched

[[Agentic AI Infrastructure]], [[KV Cache Management]]

## Raw source

[github.com/Tencent/TencentDB-Agent-Memory](https://github.com/Tencent/TencentDB-Agent-Memory) — Tencent open-source project README (2026-05-16 capture). Read 2026-05-17.
