---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 4
---

# Inference Disaggregation

## What

Splitting LLM serving into separate **prefill** (context processing, FTL-governed) and **decode** (generation, TTL-governed) pools, with KV cache transferred between them. The architectural premise: prefill is math-heavy + bursty, decode is bandwidth-heavy + steady; co-locating them on the same model instances forces a single mapping to optimize both simultaneously, leaving Pareto room on the table. Disaggregation is one of the most-debated 2025-2026 LLM-serving design choices.

## Current understanding

**Disaggregation is NOT a universal speedup** ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]], the 100k-design-point NVIDIA study). The wins are concentrated in:

- **Prefill-heavy traffic** (ISL >> OSL) — when decode-optimized mappings would otherwise tank prefill throughput.
- **Larger models** (>10B params) — more GPUs → richer parallelism search space → more value in choosing distinct prefill vs decode mappings.
- **Larger NVLink domains** — bigger intra-node fabric widens the EP/TP options for the decode pool.

**Where it doesn't help much**: small models, generation-heavy traffic, relaxed-latency-only deployments. Piggybacked co-located serving (in-flight batching + context chunking) is competitive there.

**The load-bearing system primitive** is **dynamic rate matching** — the Ctx:Gen GPU ratio. A static ratio is Pareto-suboptimal across latency regimes (Beyond-the-Buzz's Fig 10: ratio=3.5 wins at relaxed latency but tanks at tight; ratio=0.5 is the inverse). Any production disagg system must adapt the ratio at runtime.

**KV-cache transfer bandwidth is NOT the bottleneck**. The analytical math (egress / ingress equations) shows existing provisioned datacenter bandwidth is sufficient across realistic SLAs. The "disagg is bandwidth-bound" hypothesis is debunked. The remaining transfer concerns are observability ([[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] surfaces NIXL KV-transfer metrics to Prometheus via the generalized `KVConnectorStats` abstraction — without that visibility, PD-disagg deployments operate with a data-plane blind spot).

**Chunked Pipeline Parallelism (CPP)** is the prefill-side trick — split input sequences into chunks, process each using prior-chunk KV but not prior outputs, overlap layer-N of new chunks with layer-(N+1) of old chunks. Reduces FTL without forcing wide TP. Demonstrated effective on DeepSeek-R1 at ISL=256K on 64 GPUs (EP × PP = 64).

**MLA-specific overhead** in piggybacked co-located serving: prefill chunking causes redundant down/up-projection of multi-latent attention per chunk. Proposed mitigation: cache up-projected KV from earlier chunks. ([[Attention Kernels]] cross-reference: FlashMLA's seesaw schedule addresses the kernel-level half; the cache mitigation is the framework-level half.)

**Observability for disagg** is splitting into two stacks: SGLang ([[2025-11-17-feature-sglang-tracing-fine-grained-trac]]) goes OpenTelemetry-spans-first with PD-disaggregation as a first-class case (mini-LB, prefill, decode all traced); vLLM ([[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]) goes Prometheus-metrics-first. The Pan+Li survey ([[2026-05-08-a-survey-of-llm-inference-systems]]) treats disaggregation as a first-class architecture in the system-composition taxonomy.

## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — the foundational 100k-design-point NVIDIA disagg study; CPP + dynamic rate matching + KV bandwidth analysis.
- [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] — SGLang OpenTelemetry tracing with PD-disagg as a first-class case.
- [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] — vLLM NIXL/KVConnectorStats observability for PD-disagg data plane.
- [[2026-05-08-a-survey-of-llm-inference-systems]] — Pan+Li survey treating disaggregation as a first-class composition tier.

## Open threads

- (to be filled in)
- Are simulator-based design-space-exploration numbers translatable to dollars/W for capacity planning? Beyond-the-Buzz reports normalized Pareto frontiers; the missing translation is the cost-engineering step. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]


## Sources drawn on

- (auto-populated by reindex)
