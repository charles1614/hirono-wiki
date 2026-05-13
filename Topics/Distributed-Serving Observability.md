---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 2
---

# Distributed-Serving Observability

## What

*Stub topic — to be expanded from sources.*

## Current understanding

Distributed-serving observability addresses a specific gap that general-purpose profiling tools cannot close: **request-level visibility across multiple nodes, parallelism dimensions, and pipeline stages** in production LLM inference clusters. The two sources captured here represent the leading open-source frameworks converging on this problem from different architectural angles — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] (SGLang, spans-first) and [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] (vLLM, metrics-first) — and together they define the current state of the art.

**The production gap is the same in both frameworks.** PyTorch Profiler cannot collect over long windows, cannot observe TP/DP/PP/EP parallelism without losing coherence, and has no concept of cross-node request identity. At scale, this means operators know aggregate throughput but are blind to: which stage of a PD-disaggregated pipeline introduced latency, whether a given thread is underutilized, or whether KV-transfer is the bottleneck in a prefill/decode split. Both PRs treat this as a first-class production engineering problem, not a debug convenience.

**SGLang chose distributed tracing (spans) as the primitive** [[2025-11-17-feature-sglang-tracing-fine-grained-trac]]. The framework adopted [[OpenTelemetry]] as the span format — aligning with industry-standard distributed tracing rather than inventing a custom wire format — and ships dual visualization: **Jaeger/Zipkin** for request-centric view ("where did this slow request spend its time?") and **Perfetto** for thread-centric view ("is this thread idle?"). The non-obvious engineering problem was OTel's single-context tracking assumption: continuous batching causes multiple request contexts to coexist at the same moment, breaking standard OTel context propagation. SGLang had to resolve this mismatch. PD-disaggregation was a first-class case from the start, with mini-LB, prefill nodes, and decode nodes all in scope. The tracing framework ships as part of the 2025 H2 Distributed Serving Enhancement roadmap (#8210).

**vLLM chose Prometheus metrics as the primitive** [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]. Rather than spans, it exposes per-KVConnector transfer metrics (sizes, durations, counts) to Prometheus, consumable by existing Grafana dashboards. The architecturally significant move in PR #26811 was generalizing from NIXL-specific metric fields to a **connector-agnostic `KVConnectorStats` abstraction** — any future KV-transfer backend (Mooncake, custom RDMA) inherits the same dashboard story without patching `vllm/v1/metrics/`. The histogram bucket design (`2KB → 8GB` log-scale × 4) is explicitly tuned for KV transfer sizes spanning small-page to large-model payloads.

**Where the two approaches agree**: observability must be native to the serving framework, not bolted on post-hoc. Both treat PD-disaggregation as the hardest case and design for it first. Both expose data in formats that integrate with existing operator tooling (OTel-compatible spans for Jaeger/Zipkin/Perfetto; Prometheus exposition for Grafana). Neither treats "works in single-node mode" as sufficient.

**Where they diverge**: SGLang's span model answers "what happened to this specific request, step by step" — it is latency-attribution-first. vLLM's metrics model answers "what is the KV-transfer subsystem doing over time" — it is throughput/SLO-monitoring-first. These are complementary rather than competing: a complete observability stack for a disaggregated serving cluster would benefit from both (request-level tracing for debugging long-tail latency, Prometheus metrics for alerting and capacity planning). The Perfetto + [[PyTorch Profiler]] merge that SGLang enables is a meaningful bridge between the two views — it puts request-level context alongside operator-level kernel timings in one artifact.

**Load-bearing primitives established so far**: OTel spans with custom multi-context resolution (SGLang); `KVConnectorStats` abstraction for pluggable connector metrics (vLLM); dual-visualization (Jaeger + Perfetto) for request-centric vs thread-centric analysis; log-scale histogram bucket design for KV transfer sizes. The mini-LB deprecation signal in SGLang (Jan 2026) points toward `sglang model gateway` as the preferred surface for traceable PD-disagg going forward.

## Open threads

- Tracing-first (SGLang/OpenTelemetry spans) vs metrics-first (vLLM/Prometheus): convergence opportunity (one instrumentation emits both?) or two ecosystems specializing? Same observability need, different shapes today. — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Continuous-batching context misalignment is a real cross-cutting problem (SGLang had to patch OTel's single-context limitation). Does this pattern generalize to any batched-async server, or specific to LLM-decoding? — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]]
- KVConnectorStats abstraction's full surface — what's planned beyond NIXL's current metrics? Queue depths, retransmit counts, fabric-level errors? — [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Mooncake (external KV-store backend) integration with KVConnectorStats: clean slot-in via the new abstraction or needs extension? — [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Perfetto-merged-with-PyTorch-Profiler artifact — what's the join key (timestamps? thread IDs?)? Process boundaries make naive joins hard. The most novel claim in the SGLang tracing FR. — [[2025-11-17-feature-sglang-tracing-fine-grained-trac]]


## Sources drawn on

- (auto-populated by reindex)
