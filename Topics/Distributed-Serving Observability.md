---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 2
---

# Distributed-Serving Observability

## What

*Stub topic — to be expanded from sources.*

## Current understanding

*Synthesis pending. See Sources drawn on below.*

## Open threads

- Tracing-first (SGLang/OpenTelemetry spans) vs metrics-first (vLLM/Prometheus): convergence opportunity (one instrumentation emits both?) or two ecosystems specializing? Same observability need, different shapes today. — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Continuous-batching context misalignment is a real cross-cutting problem (SGLang had to patch OTel's single-context limitation). Does this pattern generalize to any batched-async server, or specific to LLM-decoding? — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]]
- KVConnectorStats abstraction's full surface — what's planned beyond NIXL's current metrics? Queue depths, retransmit counts, fabric-level errors? — [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Mooncake (external KV-store backend) integration with KVConnectorStats: clean slot-in via the new abstraction or needs extension? — [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Perfetto-merged-with-PyTorch-Profiler artifact — what's the join key (timestamps? thread IDs?)? Process boundaries make naive joins hard. The most novel claim in the SGLang tracing FR. — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]]


## Sources drawn on

- (auto-populated by reindex)
