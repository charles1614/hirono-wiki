---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 24
tier: active
---

# Inference Disaggregation

LLM serving architecture that separates prefill (context) and decode (generation) compute onto distinct GPU pools to optimize each phase independently.

## Synthesis






Inference disaggregation separates prefill (compute-bound, FTL-dominated) and decode (memory-bandwidth-bound, TTL-dominated) onto distinct GPU pools so each phase can be scaled with independently chosen parallelism. NVIDIA's systematic 100k+ design-point study (Beyond the Buzz) finds disaggregation's benefits concentrated in prefill-heavy traffic on larger (>10B) models, while co-located piggybacked serving with chunked prefill is competitive for small models or generation-heavy workloads — and that dynamic Ctx:Gen rate matching is the load-bearing system primitive (fixed static ratios degrade sharply across latency regimes). KV cache egress bandwidth is not the bottleneck commonly assumed: NVIDIA's analytical equations show egress drops as ISL grows (FTL scales superlinearly via quadratic attention while KV scales linearly) and ingress is inversely proportional to OSL, confirming provisioned datacenter bandwidth is sufficient. Hardware asymmetry forces disaggregation in practice — Ant Group's H20-96G deployment adopted PD separation because the H20's ~15% of H800 FP8/BF16 compute paired with 2.25× NVLink bandwidth makes co-located mapping Pareto-suboptimal, and at large EP scale on DeepSeek-V3, DeepEP's normal (prefill, symbolic shapes) and low-latency (decode, CUDA-Graph-compatible) dispatch modes cannot coexist in one engine. Production observability is maturing: vLLM's PR #26811 added connector-agnostic KVConnector Prometheus metrics (2KB→8GB log-scale × 4 histograms) and SGLang's OpenTelemetry tracing treats PD-disaggregation as first-class across mini-LB, prefill, and decode tiers.






## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
