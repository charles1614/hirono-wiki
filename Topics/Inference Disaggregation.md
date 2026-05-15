---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 22
---

# Inference Disaggregation

## What

Splitting LLM serving into separate **prefill** (context processing, FTL-governed) and **decode** (generation, TTL-governed) pools, with KV cache transferred between them. The architectural premise: prefill is math-heavy + bursty, decode is bandwidth-heavy + steady; co-locating them on the same model instances forces a single mapping to optimize both simultaneously, leaving Pareto room on the table. Disaggregation is one of the most-debated 2025-2026 LLM-serving design choices.

## Current understanding

**Disaggregation is not a universal speedup** — this is the sharpest consensus across the corpus. The NVIDIA systematic study ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) simulated hundreds of thousands of design points and found that wins are concentrated in two conditions: **prefill-heavy traffic** (ISL >> OSL) and **larger models** (>10B parameters). Small-model, decode-heavy, or relaxed-latency-only workloads see little advantage over well-tuned piggybacked co-located serving (continuous batching + context chunking). The Pan+Li survey ([[2026-05-08-a-survey-of-llm-inference-systems]]) treats disaggregated inference as a first-class architecture in the system-composition taxonomy — alongside single-replica, multi-replica, and serverless — confirming it is no longer a research curiosity but a production design point that demands evaluation.

**The architectural premise** is that prefill (context processing, FTL-governed: math-heavy, bursty) and decode (generation, TTL-governed: bandwidth-heavy, steady) have fundamentally different resource profiles. Co-locating them forces a single GPU mapping to optimize both simultaneously. Disaggregation lets each pool choose its own parallelism strategy: prefill pools optimize tensor/expert parallelism for throughput under FTL SLAs; decode pools can pursue aggressive TP freed from the prefill balancing constraint — Llama-3.1-70B's decode TP scales from 2× to 64× as TTL tightens ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]).

**The load-bearing system primitive is dynamic rate matching** — the Ctx:Gen GPU ratio. A fixed ratio is Pareto-suboptimal across latency regimes: a 3.5 ratio wins at relaxed latency but degrades sharply as TTL tightens; 0.5 is the inverse. Any production disaggregated deployment must adapt this ratio at runtime ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]). A disaggregated system that pins its Ctx:Gen split statically is leaving substantial performance on the table.

**KV cache transfer bandwidth is not the bottleneck.** The NVIDIA paper's analytical equations (egress and ingress as functions of ISL, OSL, FTL, TTL) show existing provisioned datacenter bandwidth is sufficient across realistic SLAs. Egress bandwidth requirements actually drop as ISL grows, because FTL scales superlinearly via attention's quadratic cost while KV size scales linearly. The "disagg is bandwidth-bound" hypothesis is formally debunked ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]).

**Chunked Pipeline Parallelism (CPP)** is the prefill-side technique for hitting FTL SLAs without forcing wide tensor parallelism: split input sequences into chunks, process each using prior-chunk KV (but not prior outputs), and overlap layer-N of new chunks with layer-(N+1) of old chunks via PP. Demonstrated on DeepSeek-R1 at ISL=256K on 64 GPUs (EP × PP = 64). One MLA-specific complication: prefill chunking with multi-latent attention causes redundant down/up-projection per chunk — proposed mitigation is caching up-projected KV from earlier chunks ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]).

**Architecture sensitivity is non-trivial.** The boundary where disaggregation wins moves with attention mechanism (MLA vs GQA) and model shape. The NVIDIA study shows disagg wins differ for DeepSeek-R1 vs Llama-3.1-70B at the same interactivity targets. Larger NVLink domains improve outcomes by widening EP/TP options for the decode pool. This makes disaggregation a decision that must be evaluated per-model-per-traffic-shape, not a blanket infrastructure choice ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]).

**PD disaggregation is not merely beneficial but architecturally required for large-scale MoE serving with DeepEP.** SGLang's 96-GPU DeepSeek-V3 deployment ([[2025-09-05-deploying-deepseek-with-pd-disaggregatio]]) surfaces a hard constraint: DeepEP's two dispatch modes — normal dispatch (prefill: throughput-optimized, symbolic shapes, incompatible with CUDA Graph) and low-latency dispatch (decode: latency-minimized, pre-allocated fixed memory, CUDA-Graph-compatible) — cannot coexist in the same communication group without disaggregation. A unified scheduling engine forces one mode for all requests, blocking DP Attention + CUDA Graph co-deployment. PD disaggregation dissolves the constraint by giving each phase its own communication group. Three additional unified-scheduling pathologies are diagnosed: prefill batches interrupt decode, DP Attention imbalance under mixed-phase batches, and the dispatch-mode conflict itself.

**Observability for disaggregated deployments is now a distinct engineering concern**, and the two major frameworks are taking different shapes. SGLang ([[2025-11-17-feature-sglang-tracing-fine-grained-trac]]) goes **OpenTelemetry-spans-first** — PD-disaggregation (mini-LB, prefill nodes, decode nodes) is a first-class case in the tracing design, with Jaeger/Zipkin for request-centric views and Perfetto for thread-centric views. A notable implementation challenge was adapting OTel's single-context model to continuous batching's multi-request interleaving. vLLM ([[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]) goes **Prometheus-metrics-first** — PR #26811 exposed KV-transfer metrics (sizes, durations, counts) via a generalized `KVConnectorStats` abstraction so NIXL and future KV backends plug into the same dashboard story. Before this PR, PD-disagg vLLM deployments had no visibility into the data-plane KV transfer path.

## Comparison

| Axis | Disaggregated serving | Piggybacked co-located serving |
|---|---|---|
| **Best-fit traffic shape** | Prefill-heavy (ISL >> OSL) ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | Decode-heavy or balanced traffic ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |
| **Best-fit model size** | Larger models (>10B params) — richer parallelism search space ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | Small models — marginal disagg benefit ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |
| **Latency SLA sensitivity** | Wins grow as FTL/TTL tighten; dynamic Ctx:Gen ratio required ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | Competitive at relaxed latency targets ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |
| **Decode parallelism flexibility** | Aggressive TP scaling (2× → 64× for Llama-3.1-70B as TTL tightens) freed from prefill constraints ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | TP constrained by prefill balancing requirements ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |
| **KV cache transfer overhead** | Existing datacenter bandwidth sufficient; egress drops as ISL grows ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | No KV transfer cost (in-process) ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |
| **MLA / attention mechanism sensitivity** | Disagg wins differ for MLA (DeepSeek-R1) vs GQA (Llama); CPP adds per-chunk redundant projection with MLA ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | Piggybacking benefit "highly sensitive to attention mechanism" — most beneficial under relaxed latency + generation-heavy traffic ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |
| **NVLink domain benefit** | Larger NVLink domains widen EP/TP options for decode pool ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | ? |
| **System composition classification** | First-class architecture tier in inference system taxonomy ([[2026-05-08-a-survey-of-llm-inference-systems]]) | Subsumed under single-replica / multi-replica tiers ([[2026-05-08-a-survey-of-llm-inference-systems]]) |
| **Observability approach (SGLang)** | OTel spans-first; mini-LB + prefill nodes + decode nodes all traced; Jaeger/Zipkin + Perfetto dual visualization ([[2025-11-17-feature-sglang-tracing-fine-grained-trac]]) | N/A — no PD data-plane to trace |
| **Observability approach (vLLM)** | Prometheus metrics via generalized `KVConnectorStats`; transfer sizes, durations, counts per connector ([[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]) | N/A — no KV connector in the data path |
| **Operational complexity** | Dynamic rate matching required; two pool types to manage; KV transfer data plane ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) | Single pool; simpler deployment; context chunking is the main tuning knob ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) |

## Open threads

- Are simulator-based design-space-exploration numbers translatable to dollars/W for capacity planning? Beyond-the-Buzz reports normalized Pareto frontiers; the missing translation is the cost-engineering step. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- SGLang's MTP integration gap: simulated MTP recovers decode throughput to within 6.6% of DeepSeek's profile, but full MTP + DP Attention co-deployment is not yet implemented. Does MTP's attention overhead generalize to non-DeepSeek architectures in a disaggregated setup? — [[2025-09-05-deploying-deepseek-with-pd-disaggregatio]]
- **CPP vs PCP naming collision**: the corpus uses both terms for "long-context MoE prefill parallelism" but they are different mechanisms. CPP (Chunked Pipeline Parallelism, [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) overlaps PP stages at the disaggregated-serving level to reduce FTL without wide TP. PCP (Prefill Context Parallelism, [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]) is a vLLM in-engine parallelism axis that adds workers, shards tokens by interleaved position, and performs AllGather+ReduceScatter within MoE layers. Whether SGLang/TRT-LLM implement an analogous in-engine PCP axis is not captured in current sources.

## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — the foundational 100k-design-point NVIDIA disagg study; CPP + dynamic rate matching + KV bandwidth analysis.
- [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] — SGLang OpenTelemetry tracing with PD-disagg as a first-class case.
- [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] — vLLM NIXL/KVConnectorStats observability for PD-disagg data plane.
- [[2026-05-08-a-survey-of-llm-inference-systems]] — Pan+Li survey treating disaggregation as a first-class composition tier.
- [[2025-09-05-deploying-deepseek-with-pd-disaggregatio]] — SGLang 96-GPU DeepSeek-V3 deployment; surfaces DeepEP dispatch-mode incompatibility as hard constraint; EPLB + TBO as the two load-bearing optimizations at scale.
- [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]] — vLLM distributed architecture doc; specifies [[Prefill Context Parallelism]] (PCP) as a distinct in-engine mechanism from CPP; PCP adds workers and shards token+expert weights; currently MoE-only.
- PyTorch Conference 2025 session #78 ("Serving PyTorch LLMs at Scale: Disaggregated Inference With Kubernetes and llm-d") highlights disaggregated inference with Kubernetes as a production deployment pattern, alongside [[vLLM]] at scale. — [[2025-12-14-vllm-project-vllm-in-pytorch-conference-]]
- [[2025-12-04-突破显存瓶颈-基于-deepseek-v3-2-exp-的-latent-cac]] — Baidu AIAK ESS: Latent Cache offload in PD-disaggregated DeepSeek-V3.2-Exp; FlashTrans (UVA-based), DA/DBA Overlap; simulator results showing 123% throughput gain at 128K context.

## Observations

- Alibaba [[RTP-LLM]] PD-disaggregated [[DeepSeek-V3]] on RoCE: Prefill 4-node 32-card EP=32; Decode 18-node 144-card EP=144 (128+16 redundant); 4:1 PD ratio not production-optimal (dynamic elastic scaling needed in production); 4K/2K I/O achieves Prefill 42.6K TPS/node + Decode 14.7K TPS/node. — [[2025-10-09-如何重现-deepseek-推理性能突破]]

