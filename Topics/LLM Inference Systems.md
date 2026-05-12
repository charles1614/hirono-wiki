---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 10
---

# LLM Inference Systems

## What

End-to-end systems for serving large language models — from request scheduling to kernel-level attention, with everything in between: continuous batching, paged KV management, parallelism (TP/EP/CP), comm-overlap, observability, disaggregation. The denominator is *latency × throughput Pareto* under operator SLAs (FTL, TTL). The 2025-2026 landscape has matured from "vLLM is the open-source default" to a multi-stack ecosystem (vLLM, SGLang, TensorRT-LLM, Mooncake, DeepFlow) with distinct design philosophies but converging primitives.

## Current understanding

**Three operator-spanning primitives** unify the design space, per the Pan+Li survey ([[2026-05-08-a-survey-of-llm-inference-systems]]): **load prediction** (anticipating request shape and arrival), **adaptive mechanisms** (runtime scheduling/batching/quantization adjustment), and **cost reduction** (caching, eviction, recomputation avoidance, on-the-fly quantization). Almost every named technique in the ecosystem fits cleanly into one or more of these axes.

**System composition** runs from single-replica → multi-replica → disaggregated → serverless. The survey treats serverless as most-composed; an open thread is whether serverless is instead orthogonal (you can serverlessify any of the prior three).

**Where the design space has settled** (2025-2026):

- **Continuous batching** is the unambiguous default; the question is *which* batching policy (in-flight, piggybacked, chunked-prefill). vLLM, SGLang, TensorRT-LLM all converge on it; the variation is at the scheduler level. [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] illustrates the kernel-level consequence: continuous-batching reshapes which workloads are compute-bound vs memory-bound (MLA decoding at `h_q=128` is compute-bound on H800, contra the usual "attention is memory-bound" intuition).
- **PagedAttention** is the canonical KV-management primitive ([[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]]'s 1200-LoC vLLM clone reproduces it; the survey treats it as table-stakes).
- **Disaggregation** is the most-debated architectural choice — see the dedicated [[Inference Disaggregation]] Topic. [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]'s 100k-design-point study is the empirical anchor.
- **Speculation** at production scale is no longer assumed throughput-degrading. [[2025-10-09-eagle-3-scalingupinference-acceleration-]] in SGLang shows 40% throughput improvement at batch size 64 — refuting the conventional wisdom that draft-model speculation is a low-batch-only optimization.
- **Comm-overlap** ([[2025-10-09-flux-fast-software-based-communication-o]]) gives another ~1.3-1.7× on top of TP-only serving via kernel-fusion comm-compute. Composable with disaggregation (Flux improves within-pool execution; disagg improves across-pool).

**Where the design space is still splintering**:

- **Observability surface**: SGLang ([[2025-11-17-feature-sglang-tracing-fine-grained-trac]]) bets on OpenTelemetry spans; vLLM ([[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]) bets on Prometheus metrics. Both solve the same need; convergence vs specialization is an open thread (in [[Distributed-Serving Observability]]).
- **Hardware target**: most stacks are GPU-first (Blackwell B200/GB200/H200 across vendors). Ironwood ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) is the only inference-first TPU; whether it pulls a slice of frontier-inference workloads off CUDA is unresolved.
- **Production-deployment shape**: NVIDIA's TensorRT-LLM publishes operator recipes ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]'s two-mode gpt-oss-120b config). vLLM/SGLang publish less prescriptive recipes; operators write their own. Whether prescriptive deployment recipes vs framework-as-toolkit is the dominant pattern is unclear.

The survey's **cs.DB framing** (treating LLM inference as a database-systems problem — caching, eviction, query planning) is a useful lens that hasn't yet propagated through the practitioner stacks; classical DB techniques (cost-based query optimization, MVCC, semi-join reduction) are under-applied.

## Sources drawn on

- [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] — NVIDIA's two-mode gpt-oss-120b deployment recipe (low-latency vs max-throughput on Blackwell).
- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — systematic 100k-design-point disaggregation study (NVIDIA, foundational).
- [[2025-10-09-eagle-3-scalingupinference-acceleration-]] — EAGLE-3 speculation; 40% SGLang throughput gain at batch 64.
- [[2025-10-09-flux-fast-software-based-communication-o]] — Flux kernel-fusion comm-overlap, ByteDance/PKU.
- [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] — SGLang OpenTelemetry tracing FR.
- [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] — vLLM Prometheus metrics + KVConnectorStats abstraction.
- [[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]] — 1,200-LoC vLLM re-implementation for pedagogy.
- [[2026-01-09-google-tpus-explained-architecture-perfo]] — TPU/Gemini context for the hardware axis.
- [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — Google's inference-first TPU.
- [[2026-05-08-a-survey-of-llm-inference-systems]] — Pan+Li cs.DB-framed survey; the three-primitive lens.

## Open threads

- (to be filled in)
- Pan + Li survey orders compositions single-replica → multi-replica → disaggregated → serverless, treating serverless as most-composed. Is serverless instead orthogonal — any of the prior three could be serverlessified? — [[2026-05-08-a-survey-of-llm-inference-systems]]
- TensorRT-LLM's `stream_interval = 10` detokenization-overhead workaround — is this a general continuous-batching problem (cf. SGLang's tracing FR) or TRTLLM tokenizer-path specific? — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]


## Sources drawn on

- (auto-populated by reindex)
