---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 8
tier: active
---

# Inference Disaggregation

LLM serving architecture that separates prefill (context) and decode (generation) compute onto distinct GPU pools to optimize each phase independently.

## Synthesis


Inference disaggregation separates prefill (context ingestion) and decode (token generation) onto distinct GPU pools so each phase can be parallelized and scaled independently, since the two phases have fundamentally different computational profiles: prefill is compute-bound and dominated by First-Token Latency, while decode is memory-bandwidth-bound and governed by per-token Token-to-Token Latency. A systematic NVIDIA simulation study across DeepSeek-R1 and Llama-3.1 models finds that disaggregation's benefits are concentrated rather than universal — it meaningfully improves throughput-interactivity Pareto frontiers for prefill-heavy traffic and large models (above ~10B parameters), while co-located piggybacked serving is competitive for small models or generation-heavy workloads. The load-bearing system primitive for disaggregated deployments is dynamic rate matching: the optimal ratio of prefill-pool to decode-pool GPUs varies with model architecture and target latency, and fixing it statically at any single value leaves substantial performance on the table across latency regimes. Hardware asymmetry is a practical forcing function: Ant Group's H20-96G production deployment adopted prefill/decode disaggregation specifically because the H20's lopsided compute-to-bandwidth ratio makes a co-located mapping Pareto-suboptimal, and DeepSeek's published profiler traces confirm that prefill and decode require different SM-to-communication splits (108+24 vs freed-SM AllToAll at EP128), structurally justifying separate pools. Production observability for disaggregated clusters is an active area: vLLM's KVConnector metrics landed connector-agnostic Prometheus instrumentation for KV-cache transfer, and SGLang's tracing framework treats PD-disaggregation as a first-class case with per-node span visibility across the mini-LB, prefill, and decode tiers.


## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
