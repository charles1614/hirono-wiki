---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 7
---

# Inference Disaggregation

## What

Splitting LLM serving into separate **prefill** (context processing, FTL-governed) and **decode** (generation, TTL-governed) pools, with KV cache transferred between them. The architectural premise: prefill is math-heavy + bursty, decode is bandwidth-heavy + steady; co-locating them on the same model instances forces a single mapping to optimize both simultaneously, leaving Pareto room on the table. Disaggregation is one of the most-debated 2025-2026 LLM-serving design choices.

## Current understanding

**Disaggregation is not a universal speedup** — this is the sharpest consensus across the corpus. The NVIDIA systematic study ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) simulated hundreds of thousands of design points and found the wins are concentrated: **prefill-heavy traffic** (ISL >> OSL) and **larger models** (>10B parameters) benefit substantially; small-model, decode-heavy, or relaxed-latency-only workloads see little advantage over well-tuned piggybacked co-located serving (continuous batching + context chunking). The Pan+Li survey ([[2026-05-08-a-survey-of-llm-inference-systems]]) treats disaggregated inference as a first-class architecture in the system-composition taxonomy alongside single-replica, multi-replica, and serverless — confirming it's no longer a research curiosity.

**The architectural premise** is that prefill (context processing, FTL-governed: math-heavy, bursty) and decode (generation, TTL-governed: bandwidth-heavy, steady) have fundamentally different resource profiles. Co-locating them forces a single GPU mapping to optimize both simultaneously. Disaggregation lets each pool choose its own parallelism strategy — prefill pools can optimize tensor/expert parallelism for throughput-under-latency; decode pools can pursue aggressive TP freed from the prefill balancing constraint (Llama-3.1-70B's decode TP scales from 2× to 64× as TTL tightens).

**The load-bearing system primitive is dynamic rate matching** — the Ctx:Gen GPU ratio. A fixed ratio is Pareto-suboptimal across latency regimes: a 3.5 ratio wins at relaxed latency but degrades sharply as TTL tightens; a 0.5 ratio is the inverse. Any production disaggregated deployment must adapt this ratio at runtime. This is [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]'s most actionable finding — a disaggregated system that pins its Ctx:Gen split statically is leaving substantial performance on the table.

**KV cache transfer bandwidth is not the bottleneck.** The analytical math in the NVIDIA paper (egress and ingress equations as functions of ISL, OSL, FTL, TTL) shows existing provisioned datacenter bandwidth is sufficient across realistic SLAs. Egress bandwidth requirements actually drop as ISL grows (because FTL scales superlinearly via attention's quadratic cost while KV size scales linearly). The "disagg is bandwidth-bound" hypothesis is debunked.

**Chunked Pipeline Parallelism (CPP)** is the prefill-side technique for hitting FTL SLAs without forcing wide tensor parallelism: split input sequences into chunks, process each using prior-chunk KV (but not prior outputs), and overlap layer-N of new chunks with layer-(N+1) of old chunks via PP. Effective on DeepSeek-R1 at ISL=256K on 64 GPUs (EP × PP = 64). One MLA-specific complication: prefill chunking with multi-latent attention causes redundant down/up-projection per chunk — proposed mitigation is caching up-projected KV from earlier chunks.

**Observability for disaggregated deployments is now a distinct engineering concern**, and the two major frameworks are taking different shapes. SGLang ([[2025-11-17-feature-sglang-tracing-fine-grained-trac]]) goes **OpenTelemetry-spans-first** — PD-disaggregation (mini-LB, prefill nodes, decode nodes) is a first-class case in the tracing design, with Jaeger/Zipkin for request-centric views and Perfetto for thread-centric views; a notable implementation challenge was adapting OTel's single-context model to continuous batching's multi-request interleaving. vLLM ([[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]) goes **Prometheus-metrics-first** — PR #26811 exposed KV-transfer metrics (sizes, durations, counts) via a generalized `KVConnectorStats` abstraction, so NIXL and future KV backends plug into the same dashboard story. Before this, PD-disagg vLLM deployments had no visibility into the data-plane KV transfer path.

**Architecture sensitivity is non-trivial**: the boundary where disaggregation wins moves with attention mechanism (MLA vs GQA) and model shape. The NVIDIA study's Fig 6 shows disagg wins are different for DeepSeek-R1 vs Llama-3.1-70B even at the same interactivity targets. Larger NVLink domains also improve the outcome — bigger intra-node fabric widens the EP/TP options for the decode pool. This makes disaggregation a decision that must be evaluated per-model-per-traffic-shape, not a blanket infrastructure choice.

## Open threads

- Are simulator-based design-space-exploration numbers translatable to dollars/W for capacity planning? Beyond-the-Buzz reports normalized Pareto frontiers; the missing translation is the cost-engineering step. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]

## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — the foundational 100k-design-point NVIDIA disagg study; CPP + dynamic rate matching + KV bandwidth analysis.
- [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] — SGLang OpenTelemetry tracing with PD-disagg as a first-class case.
- [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] — vLLM NIXL/KVConnectorStats observability for PD-disagg data plane.
- [[2026-05-08-a-survey-of-llm-inference-systems]] — Pan+Li survey treating disaggregation as a first-class composition tier.

