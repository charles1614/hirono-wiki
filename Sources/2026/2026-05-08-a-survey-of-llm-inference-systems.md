---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/abs/2506.21901
tags: [survey, llm-inference, vllm, sglang, mooncake, deepflow, scheduling, kv-cache, quantization, disaggregation]
---

# [2026-05-08] A Survey of LLM Inference Systems

## TL;DR

Survey paper (James Pan + Guoliang Li, arXiv:2506.21901 v1, Jun 27 2025, 25pp) — **systematic review of LLM inference systems** (vLLM, SGLang, Mooncake, DeepFlow) and the techniques driving their design. The unifying thesis: autoregressive generation creates *the* defining constraint, and the techniques that solve it (operators, kernels, batching, scheduling, paged memory, eviction/offloading, quantization, cache persistence) all share three primitives: **load prediction**, **adaptive mechanisms**, and **cost reduction**. The survey is organized to walk from request-processing operators up through system composition (single-replica → multi-replica → disaggregated → serverless).

## Key claims

(Abstract-level — survey-PDF not fetched in the corpus; this entry references the structure declared in the abstract.)

- **Three operator-spanning primitives** for any LLM inference technique:
  1. **Load prediction** — anticipating request shape and arrival distribution.
  2. **Adaptive mechanisms** — runtime adjustment of scheduling, batching, quantization.
  3. **Cost reduction** — caching, recomputation avoidance, eviction, quantization-on-the-fly.
- **Survey organization** (declared in abstract):
  1. Operators and algorithms for request processing.
  2. Model optimization + execution: **kernel design, batching, scheduling**.
  3. Memory management: **paged memory, eviction + offloading, quantization, cache persistence**.
  4. System composition: **single-replica → multi-replica → disaggregated inference → serverless**.
- **Named systems covered**: [[vLLM]], [[SGLang]], [[Mooncake]], [[DeepFlow]]. (Notably absent from the abstract: [[TensorRT-LLM]], possibly because survey is cs.DB framed.)
- **Database-systems framing**: filed under `cs.DB` rather than `cs.AI/cs.LG`. This is unusual and revealing — the authors are positioning LLM inference as a *systems* problem, drawing analogies to database query processing (caching, eviction, scheduling, replication). The implication: techniques from decades of DB research are directly transferable.
- **Disaggregated inference is a first-class architecture** in the survey. Pairs naturally with [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]'s systematic study of disagg at scale.
- **Serverless on shared hardware** is covered separately — recognizing that serverless inference (per-request billing on shared accelerators) is a distinct design point from dedicated single/multi-replica deployments.
- **Open challenges** discussed at end of survey (not detailed in abstract; would be the most valuable section to read in full).

## What this changes

- **As a reference**: when discussing a new inference technique, having a single citation that covers the landscape (rather than 30+ paper-by-paper refs) is invaluable. This survey takes that role for 2025.
- **For practitioners building inference stacks**: the load-prediction / adaptive-mechanism / cost-reduction framing is a useful checklist for new techniques. Each existing technique can be classified into which primitives it leans on.
- **For research direction**: the cs.DB framing nudges researchers to revisit classical DB techniques (cost-based query optimization, multi-version concurrency, semi-join reduction) for LLM inference contexts.
- **Pairs with**: [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] (focused study of disaggregation, one of the architectures the survey covers), [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] (observability for the systems the survey reviews), [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] (kernel-design instance of one of the survey's pillars).

## Entities touched

[[vLLM]], [[SGLang]], [[Mooncake]], [[DeepFlow]], [[Tsinghua]] (Guoliang Li is at Tsinghua)

## Topics touched

[[LLM Inference Systems]], [[Inference Disaggregation]], [[KV Cache Management]], [[Quantization]], [[Serverless LLM Serving]], [[Database Systems × ML Systems]]

## Open questions

- **PDF not fetched** — the abstract alone gives the skeleton; the full survey would let us cite specific frameworks vs primitives. **Worth re-fetching with the `/pdf/` URL** to extract the per-system feature comparison tables (which exist somewhere in 25 pages).
- The survey is from Jun 2025. Active inference work in late 2025 / early 2026 (Marker-quality PDF extraction era) has shipped major changes — speculative decoding at production scale ([[2025-10-09-eagle-3-scalingupinference-acceleration-]]), FP4 inference (NVFP4 lineage), MLA optimizations ([[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]). A 2026 follow-up survey would be valuable.
- **Authors' database background** (Guoliang Li is well-known in DB research): how heavily does the survey lean on DB techniques? Useful to know for someone deciding whether to study it.
- **Single-replica → multi-replica → disaggregated → serverless** ordering — the survey treats serverless as the most-composed form. Is that the right framing, or is serverless orthogonal (any of the prior three could be serverlessified)?

## Raw source

[arxiv.org/abs/2506.21901](https://arxiv.org/abs/2506.21901) — 25-page survey · v1 June 27 2025. Authors: James Pan, Guoliang Li (Tsinghua-affiliated). cs.DB filing. **Abstract only fetched in raw corpus** (URL is the `/abs/` page, not `/pdf/`). PDF at [arxiv.org/pdf/2506.21901](https://arxiv.org/pdf/2506.21901). Read 2026-05-11.
