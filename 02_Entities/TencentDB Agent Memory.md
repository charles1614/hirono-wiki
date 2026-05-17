---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 9
tier: active
---

# TencentDB Agent Memory

Tencent open-source Agent memory plugin (2026): symbolic short-term memory (Mermaid canvas) + 4-tier L0-L3 long-term semantic pyramid; OpenClaw/Hermes plugins, SQLite+sqlite-vec backend

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- TencentDB Agent Memory ([[Tencent]] open-source, 2026) is an Agent memory plugin that combines symbolic short-term memory (Mermaid canvas + offloaded tool logs in `refs/*.md`) with a four-layer long-term semantic pyramid: L0 Conversation → L1 Atom → L2 Scenario → L3 Persona. Distributed as `@tencentdb-agent-memory/memory-tencentdb` (npm) for [[OpenClaw]] plugin, and as a Docker image for [[Hermes]] (Nous Research Hermes-agent). Local backend is [[SQLite]] + sqlite-vec; hybrid retrieval is BM25 + vector + RRF. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
- Reported gains when paired with [[OpenClaw]] over continuous long-horizon sessions: WideSearch 33%→50% (+51.52% rel), tokens 221.31M→85.64M (−61.38%); SWE-bench 58.4%→64.2% (+9.93%), tokens 3474.1M→2375.4M (−33.09%) over 50 consecutive tasks per session; PersonaMem accuracy 48%→76%. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
- Defaults: hybrid recall returning 5 items, L1 extraction every 5 turns (max 20 memories per pass), persona regenerated every 50 new memories, warm-up doubling (1→2→4→...) for new sessions, jieba tokenizer for zh. Context-offload thresholds: 50% of context window for mild compression, 85% aggressive, 20% Mermaid canvas budget cap. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
- Exposes `tdai_memory_search` and `tdai_conversation_search` as Agent tools. Memory artifacts live under `~/.openclaw/memory-tdai/` for direct file-system inspection — explicit white-box debuggability over the L3 Persona → L2 Scenario → L1 Atom → L0 Conversation chain via `result_ref` / `node_id` linkage. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
