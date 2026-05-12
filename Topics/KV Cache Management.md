---
created: 2026-05-11
updated: 2026-05-12
type: topic
source_count: 6
---

# KV Cache Management

## What

The accumulated key/value tensors that attention reuses across decoding steps — and the systems-level problem of where they live, how they're sharded, how they move between pools (in disaggregated serving), and how their bandwidth + capacity bound serving throughput. KV management is the load-bearing operator concern that distinguishes "inference is slow" from "inference scales": **per-request KV is small, but at high concurrency it's the binding constraint on both memory and inter-stage bandwidth**.

## Current understanding

**KV-cache transfer bandwidth is NOT the disaggregation bottleneck** ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]). The analytical egress/ingress equations (NVIDIA's Beyond-the-Buzz paper, §5.1) show provisioned datacenter bandwidth is sufficient across realistic SLAs:

- Egress (prefill side): drops as ISL grows — FTL scales superlinearly via attention's quadratic cost, while KV size scales linearly.
- Ingress (decode side): inversely proportional to OSL; tightening TTL adds more decode GPUs, lowering per-GPU bandwidth.
- KV-cache duplication only counts GPUs that actually shard KV (TP > N_kvheads replicates rather than shards).

This debunks the common "disagg is bandwidth-bound" worry. The remaining KV-transfer concerns are **observability**, not bandwidth.

**Observability for the KV-transfer data plane** is just landing in production. [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] (vLLM PR #26811) exposes NIXL transfer durations / sizes / counts to Prometheus via the new generalized **`KVConnectorStats`** abstraction. Connector-agnostic by design — future KV-transfer backends (Mooncake, custom RDMA) inherit the dashboard story. Histogram-bucket recipe (`2KB...8GB` log-scale × 4) is generally borrowable.

**KV-cache duplication policy interacts with parallelism choice**. When TP rank count exceeds `N_kvheads`, KV cache is replicated across TP ranks rather than sharded. So a TP=8 deployment with `N_kvheads=8` has full KV-replication; the same model with `N_kvheads=64` would shard 8-ways. This matters for both per-GPU bandwidth requirements and total KV memory footprint.

**The Pan+Li survey** ([[2026-05-08-a-survey-of-llm-inference-systems]]) treats memory management — **paged memory, eviction + offloading, quantization, cache persistence** — as one of the four major axes of the LLM inference design space (alongside operators-and-algorithms, model-optimization-and-execution, and system-composition). The survey's database-systems framing is most natural here: paged KV is the analogue of buffer-pool management; eviction policies are the analogue of LRU/MRU/clock; cache persistence is the analogue of warm-restart from disk.


## Open threads


## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — analytical KV-bandwidth equations + the "datacenter bandwidth is sufficient" finding.
- [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] — vLLM NIXL/KVConnectorStats observability for the KV-transfer data plane.
- [[2026-05-08-a-survey-of-llm-inference-systems]] — Pan+Li survey treating memory management as a first-class design axis with database-systems framing.

