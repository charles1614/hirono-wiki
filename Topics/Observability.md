---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 7
---

# Observability

## What

Surfacing internal state of distributed serving systems — traces, metrics, logs — for debugging and capacity planning.

## Current understanding

The corpus currently covers observability at three distinct layers of the LLM stack: **request-level distributed tracing** (spans), **metrics exposition** (time-series / histograms), and **low-level profiler traces** (GPU timeline). Each is a different tool for a different diagnostic question, and the Sources reveal that all three layers are actively being filled in for the same production systems (SGLang, vLLM, DeepSeek) at roughly the same moment.

**Request-level tracing.** [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] describes SGLang's built-in tracing framework, which uses [[OpenTelemetry]] spans as the wire format. The motivating gap was that PyTorch Profiler can neither run over long production windows nor observe multi-parallelism (TP/DP/PP/EP) concurrency — so a complementary layer was needed. The implementation chose two visualization shapes that answer different questions: Jaeger/Zipkin for request-centric views ("where did this slow request spend its time?") and [[Perfetto]] for thread-centric views ("is this resource underutilized?"). A concrete technical novelty: standard OTel assumes single-context tracking, but continuous batching causes multiple request contexts to coexist simultaneously, so a custom fix was required. PD-disaggregated serving (prefill nodes, decode nodes, mini-LB) was a first-class case from the start.

**Metrics exposition.** [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] describes vLLM's parallel effort: exposing KV-cache connector transfer/post metrics (sizes, durations, counts) to Prometheus so operators can build [[Grafana]] dashboards over PD-disaggregated deployments. The architecturally durable move was to generalize from NIXL-specific metrics to a `KVConnectorStats` abstraction, so any future KV-transfer backend (Mooncake, custom RDMA) inherits the dashboard story. The histogram bucket recipe used — `2KB → 8GB` in log-scale × 4 steps — is a concrete transferable artifact for any serving-infrastructure histogram spanning small pages to large models.

**GPU profiler traces.** [[2026-04-03-deepseek-ai-profile-data-analyze-computa]] represents a different observability shape: DeepSeek published the actual PyTorch Profiler JSON traces for V3/R1 training and inference (prefill + decode) so the community can inspect their computation-communication overlap schedules at trace level. This is "publish the receipts" as observability primitive — not a framework but a baseline dataset against which alternative serving stacks can diff their own traces to find overlap-opportunity gaps.

**Automation of profiler analysis.** [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]] shows the ergonomic layer above raw profiler files: a unified analysis script (`analyze_sglang_torch_profile.py`) that automates trace collection → stage split → Perfetto rendering → kernel classification → overlap/fuse-opportunity detection. The same Source documents a staged CUDA crash debug SKILL (verbosity levels 1/3/5/10, with offline replay of `inputs.pt` + `metadata.json` at level 10) — turning a transient `device-side assert triggered` into a replayable problem sample.

**Agent observability as a distinct sub-domain.** [[2026-04-01-openclaw-observability-基于-duckdb-构建-open]] extends the pattern to AI agents rather than serving systems. Its four-layer architecture (Collection → Modeling → Storage → Visualization) maps naturally onto the same tracing primitives: TraceID/ParentID trees, session-level timelines, structured event records. The load-bearing storage choice is DuckDB rather than SQLite, justified by 6×–56× speedup on the OLAP query shapes observability dashboards actually run (group-by aggregation, time-window scans, JSON-payload extraction). The benchmark is a transferable engineering argument: **agent traces are OLAP workloads**, and row-oriented stores pay a large penalty for the queries operators run on them.

**Where sources agree.** All Sources treat observability as a multi-layer problem: no single tool covers the full diagnostic surface. There is consistent agreement that production-scale parallelism (TP/DP/PP/EP) and disaggregated architectures (separate prefill/decode pools) create observability challenges that existing general-purpose tooling (standard OTel, vanilla PyTorch Profiler) does not address without modification. Prometheus/Grafana is the de facto operator dashboard layer; OTel spans are the de facto request-tracing format; Perfetto/chrome-tracing is the de facto low-level GPU timeline viewer.

**Where sources differ.** SGLang went spans-first (OTel as the canonical trace format, metrics as secondary); vLLM went metrics-first (Prometheus exposition, no published span-based tracing as of these Sources). Whether these converge to a shared observability stack across serving frameworks is an open question not yet resolved in the corpus.

## Open threads

## Sources drawn on

- [[2025-08-18-installation-guide-nsight-systems]] — install reference for [[Nsight Systems]], the system-level GPU/CPU profiler; covers CUPTI + NVTX as the underlying trace mechanisms for the GPU timeline layer
