---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://github.com/sgl-project/sglang/issues/8965
tags: [observability, inference, tooling]
---

# [2025-11-17] [Feature] SGLang Tracing — Fine-Grained Tracking for Request Latency

## TL;DR

[[SGLang]] proposal (Issue #8965, by Tencent contributor `sufeng-buaa`, Aug 2025) for a built-in **request-tracing framework** — modeled on [[OpenTelemetry]] spans, with multi-node + multi-parallelism (TP/DP/PP/EP) visibility, dual-visualization (**Jaeger/Zipkin** for request-centric view, **Perfetto** for thread-centric), and the ability to **merge Perfetto traces with PyTorch Profiler data**. Sub-task of the 2025 H2 Distributed Serving Enhancement roadmap (#8210). Issue auto-closed Nov 2025 due to inactivity — superseded by the actual PR landing (#9962). Discussion continues into 2026 with users reporting bugs and asking for non-PD-disaggregation support.

## Key claims

- **Production gap motivating this**: SGLang at scale needs request-level tracing that PyTorch Profiler can't deliver — Profiler can't collect over long windows AND can't observe parallelism (TP/DP/PP/EP).
- **Tracing target data**:
  - Per-segment latency within a request.
  - Parallel execution status across TP/DP/PP/EP.
  - Cross-node interactions in PD-disaggregated serving.
  - Thread-level "is this request backing up / is this resource underutilized."
- **Implementation chose [[OpenTelemetry]] for spans** — explicit alignment with distributed-tracing industry standard, not a custom format. **One concrete novelty: had to resolve OTel's single-context tracking limitation** because continuous batching causes multiple request contexts to misalign at the same moment, breaking standard OTel.
- **Two visualization shapes serve different audiences**:
  - **Jaeger/Zipkin = request-centric**: one request as the top-level entry → its segments across threads/nodes → execution timeline. Answers "where did this slow request spend its time?"
  - **Perfetto = thread-centric**: one thread per row → all request segments on it as columns → idle gaps visible. Answers "is this thread underutilized?"
  - They claim to **merge Perfetto traces with PyTorch Profiler data** — a meaningful new artifact that bridges request-level and operator-level views.
- **PD-Disaggregation is a first-class case from the start**: mini-LB, prefill nodes, decode nodes all get traced. Visualization legend explicitly covers TP=1 and TP=2 cases. Non-PD-disagg is also supported (confirmed by author in Feb 2026 comment).
- **Roadmap context**: sub-task of [#8210 — Distributed Serving Enhancement on 2025 H2](https://github.com/sgl-project/sglang/issues/8210), the SGLang team's H2 2025 priority. Tracing positioned as foundational for that whole workstream (resource capacity planning, long-tail latency analysis).
- **Implementation pieces**:
  - Modular tracing package with simple APIs for instrumenting new code paths.
  - Key execution paths pre-instrumented.
  - PD-disagg multi-node tracking working at launch.
  - TP/DP/PP/EP intra-request concurrency tracing "under development" at FR time; landed by Nov 2025.
- **Closing notes (Nov 3 2025)**: GitHub bot auto-closed due to inactivity; the *feature* shipped in implementation PRs that the issue refers off to (PR #9962 submitted Sep 3). The discussion thread continues into 2026.
- **Mini-LB deprecation signal** (Jan 2026): `sufeng-buaa` notes the trace functionality in `mini_lb` will no longer be maintained — moving to `sglang model gateway` as `sglang tracing v2` lands. Users should adopt the gateway instead of mini-LB for traceable PD-disagg.

## Visual observations

**Jaeger view — request-centric (PD-disaggregation, TP=1)** (load-bearing)

![Jaeger request-centric view — sglang request trace showing service & operation hierarchy across PD-disaggregated nodes, with per-segment timing](https://hirono-wiki.litenext.digital/raindrop/github.com/2025-11-17-feature-sglang-tracing-fine-grained-trac/github-img-001.png)

Jaeger view of a single request's lifecycle across PD-disaggregated nodes. Request as top-level entry; threads as second-level; execution segments at third level. **This is the surface that "fine-grained tracing" actually delivers** — without it, the FR sounds abstract. Note the timeline grain (microseconds) and the per-stage breakdown (init, PD-disagg, prefill, decode).

**Perfetto view — thread-centric (PD-disaggregation, TP=1)** (load-bearing)

![Perfetto thread-centric view — sglang threads on rows, request segments on columns, colored bands for prefill / decode / disaggregation stages](https://hirono-wiki.litenext.digital/raindrop/github.com/2025-11-17-feature-sglang-tracing-fine-grained-trac/github-img-003.png)

Perfetto view of the same execution transposed: threads on rows, request segments on columns, colored bands distinguishing prefill schedule / prefill takeover / decode schedule / MHA. This is the view for "is the resource underutilized?" — gaps in any row are visible idle time.

- **Jaeger non-PD-disagg variant** (`https://hirono-wiki.litenext.digital/raindrop/github.com/2025-11-17-feature-sglang-tracing-fine-grained-trac/github-img-002.png`) — Same Jaeger layout for TP=2 non-disaggregated config. Supporting (variant of Fig 1's shape, no new claim).
- **Perfetto variant** (`https://hirono-wiki.litenext.digital/raindrop/github.com/2025-11-17-feature-sglang-tracing-fine-grained-trac/github-img-004.png`) — Alternative Perfetto view. Supporting.

## Entities touched

[[SGLang]], [[OpenTelemetry]], [[PyTorch Profiler]], [[Jaeger]], [[Perfetto]], [[Zipkin]]

## Topics touched

[[LLM Inference Systems]], [[Inference Disaggregation]], [[Distributed-Serving Observability]]

## Raw source

[github.com/sgl-project/sglang/issues/8965](https://github.com/sgl-project/sglang/issues/8965) — ~11 KB body + 4 visualization screenshots. 18 comments across 6 months (Aug 2025 → Feb 2026). Closed Nov 3 2025 by inactivity bot. Read 2026-05-11.
