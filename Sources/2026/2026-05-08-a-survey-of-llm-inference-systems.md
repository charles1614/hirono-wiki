---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/abs/2506.21901
tags: [llm, inference, survey]
---

# [2026-05-08] A Survey of LLM Inference Systems

## TL;DR

A 25-page survey by James Pan + Guoliang Li (arXiv:2506.21901, Jun 2025) that maps the full LLM-inference-system landscape — from per-request operators up to multi-replica serverless deployments. The thesis: every technique in the modern inference stack reduces to **load prediction, adaptive mechanisms, or cost reduction** in response to the irreducibly autoregressive shape of LLM decoding. Useful as the canonical scaffold to hang the rest of this corpus's inference-system reading on.

## Key claims

- The autoregressive nature of LLM decoding is the root cause of every distinctive inference-system technique — high-volume, high-velocity request workloads + token-by-token output is the workload shape the entire stack is solving for.
- Specialized inference systems (named: [[vLLM]], [[SGLang]], [[Mooncake]], [[DeepFlow]]) emerged because general DL-serving systems don't address the autoregressive shape well.
- The technique surface area splits into three layers: (1) operators / algorithms for request processing, (2) model optimization + execution — kernel design, batching, scheduling, (3) memory management — paged memory, eviction, offloading, quantization, cache persistence.
- All three layers share three underlying mechanisms: load prediction, adaptive mechanisms (something runtime-tunable), cost reduction.
- System composition: single-replica → multi-replica → disaggregated (separate prefill / decode resource pools) → serverless (shared-hardware deployment). Disaggregation is positioned as the move that gives the operator real control over resource allocation.
- Survey explicitly frames remaining challenges as open — taxonomy is mature but the operating points are not.

## Entities touched

[[vLLM]], [[SGLang]], [[Mooncake]], [[DeepFlow]]

## Topics touched

[[LLM Inference Systems]], [[Inference Disaggregation]], [[KV Cache Management]]

## Open questions

- Disaggregation gives finer resource control but at what scheduling-complexity cost? The survey lists it as a system shape; the operating-point trade-offs aren't quantified.
- "Adaptive mechanisms" is a broad bucket — which of the three (load prediction / adaptive / cost reduction) is the dominant lever in production today?
- Where does speculative decoding fit in the taxonomy (it's a request-processing technique, but the cost/quality trade-off straddles the three layers)?

## Raw source

[arxiv.org/abs/2506.21901](https://arxiv.org/abs/2506.21901) — abstract only (no PDF body fetched); 25-page paper, full text at the PDF link.
