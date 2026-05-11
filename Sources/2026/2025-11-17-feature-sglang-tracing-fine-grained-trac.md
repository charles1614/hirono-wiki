---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/sgl-project/sglang/issues/8965
tags: [sglang, observability, tracing, opentelemetry, distributed-serving, profiling]
---

# [2025-11-17] [Feature] SGLang Tracing — Fine-Grained Tracking for Request Latency

## TL;DR

[[SGLang]] proposal (Issue #8965 by Tencent contributor sufeng-buaa, Aug 2025) for a built-in request-tracing framework — modeled on [[OpenTelemetry]] spans, with multi-node + multi-parallelism (TP/DP/PP/EP) visibility, dual-visualization (Jaeger/Zipkin request-centric, Perfetto thread-centric), and the ability to merge with [[PyTorch Profiler]] data. **Sub-task of the 2025 H2 Distributed Serving Enhancement roadmap (#8210).** Issue closed Nov 2025 — superseded by the actual PR landings. Surfaces the gap: PyTorch Profiler doesn't scale to long-window distributed observability.

## Key claims

- Production gap: SGLang at scale needs request-level tracing that PyTorch Profiler can't provide — Profiler can't collect over long windows AND can't observe parallelism (TP/DP/PP/EP).
- Tracing target data: (a) per-segment latency within a request, (b) parallel execution status across TP/DP/PP/EP, (c) cross-node interactions in PD-disaggregated serving, (d) thread-level "is this request backing up / is this resource underutilized."
- Implementation chose [[OpenTelemetry]] for spans — explicit alignment with distributed-tracing industry standard, not a custom format. **One concrete novelty: had to resolve OTel's single-context tracking limitation** because continuous batching causes multiple request contexts to misalign at the same moment, breaking standard OTel.
- Two visualization shapes serve different audiences: **Jaeger/Zipkin = request-centric** (one request → its segments across threads/nodes); **Perfetto = thread-centric** (one thread → all request segments on it). They claim to *merge Perfetto traces with PyTorch Profiler data* — a meaningful new artifact.
- PD-Disaggregation is a first-class case from the start. Mini-LB, prefill nodes, decode nodes all get traced; visualization legend explicitly covers TP=1 + TP=2 cases.
- Roadmap context: sub-task of [#8210 — Distributed Serving Enhancement on 2025 H2](https://github.com/sgl-project/sglang/issues/8210), the SGLang team's H2 2025 priority. Tracing positioned as foundational for that whole workstream.
- Closing note (Nov 3): GitHub bot auto-closed due to inactivity; the *feature* shipped in implementation PRs that the issue refers off to. The discussion thread continues into 2026 with users asking for usage docs.

## Entities touched

[[SGLang]], [[OpenTelemetry]], [[PyTorch Profiler]], [[Jaeger]], [[Perfetto]], [[Zipkin]]

## Topics touched

[[LLM Inference Systems]], [[Inference Disaggregation]], [[Distributed-Serving Observability]]

## Open questions

- The OpenTelemetry single-context-tracking fix is generally useful for any continuous-batching server — has the SGLang team upstreamed it, or is this a SGLang-local patch?
- How does the SGLang tracing compare to vLLM's metrics/Prometheus story (cross-ref [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]])? vLLM goes Prometheus-first for metrics; SGLang goes OTel-spans-first for tracing. These are different observability shapes — does each ecosystem converge on the other, or stay specialized?
- Continuous-batching context misalignment is a real cross-cutting problem. Does this pattern generalize to any batched-async server, or is it specific to LLM-request decoding?
- The Perfetto-merged-with-PyTorch-Profiler artifact is the most novel claim. What's the join key — timestamps? thread IDs? Process boundaries make naive joins hard.
- Stability + design-doc completion was the explicit "2-3 weeks" deferral in Aug 2025; issue lingered until Nov. Suggests the PR was harder than expected — what slipped?

## Raw source

[github.com/sgl-project/sglang/issues/8965](https://github.com/sgl-project/sglang/issues/8965) — 11 KB body + 4 visualization screenshots. 18 comments across 6 months (Aug 2025 → Feb 2026).
