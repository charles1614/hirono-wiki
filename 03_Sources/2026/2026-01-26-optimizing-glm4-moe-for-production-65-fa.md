---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://lmsys.org/blog/2026-01-21-novita-glm4/
tags: [inference, moe, production-deployment, gpu]
---

# [2026-01-26] Optimizing GLM4-MoE for Production: 65% Faster TTFT with SGLang

## TL;DR

Novita AI blog post (LMSYS Org, January 2026) describing four production-grade [[SGLang]] optimizations for [[GLM-4.5]]-family MoE models (specifically GLM-4.7: 160 routed + 1 shared expert, 92 layers, TP8 FP8 on H200). The headline metrics are **65% TTFT reduction** and **22% TPOT improvement** under agentic coding workloads, validated on H200 clusters. Three kernel/scheduling optimizations (Shared Experts Fusion, Qknorm Fusion, Async Transfer) improve TTFT; Suffix Decoding — a model-free speculative technique exploiting output-pattern repetition in agentic sessions — further reduces TPOT.

## Key claims

- **Shared Experts Fusion** (SGLang PR #13873): merges the shared expert into the routed [[MoE]] structure (selecting top 9 of 161 experts vs. the default top-8 + 1-shared-separate). Under TP8 FP8, where the intermediate size is only 192, fusion substantially boosts SM utilization and reduces memory I/O; measured gains of **23.7% TTFT / 20.8% ITL improvement** in the PR.
- **Qknorm Fusion** (SGLang PRs #15141, #15305): fuses QK-norm and RoPE operators — both head-wise — into a single kernel. Adapted from Qwen-MoE's approach to handle GLM4-MoE's variant where only half the dimensions within a head are rotated.
- **Async Transfer** (SGLang PR #14782): in PD-disaggregation with overlapping schedules, the stock implementation delays data transfer until after the next batch's kernel launch. For GLM-4.7's 92 layers, kernel launch without CUDA Graph can take hundreds of milliseconds to over 1 second. Fix: advance the transfer to fire immediately after the corresponding GPU op completes, executing in a separate thread without blocking the main thread. Measured TTFT savings of **up to 1 second** at heavy workloads.
- **Suffix Decoding** (model-free speculative decoding): pattern-matches the current request's suffix against a cache of previously generated sequences; when a match is found, predicts upcoming tokens from the historical continuation — no draft model weights required. Analysis of 22 Claude Code sessions (17,487 conversation turns) found **39.3% output-pattern repetition**, making this effective for agentic coding.
- Combined under agentic coding workload (GLM-4.7 FP8, TP8, input=4096, output=1000, 14 req/s on H200): Suffix Decoding adds **22% TPOT reduction** on top of multi-token prediction (MTP) baseline — mean TPOT from 25.13 ms → 19.63 ms.
- All components either merged upstream to SGLang or undergoing integration; benchmark scripts published at `novitalabs/sglang` (glm_suffix branch).

## Visual observations

**lmsys-img-003.png — Async Transfer schedule diagram** (load-bearing)

![Async Transfer scheduling: stock implementation delays data transfer after kernel launch for the next batch; the fix advances transfer to immediately after its corresponding GPU ops, in a separate thread](../../raw/raindrop/lmsys.org/2026-01-26-optimizing-glm4-moe-for-production-65-fa/lmsys-img-003.png)

Spatial diagram showing the timing shift: the transferred step moves earlier in the timeline, freeing the main thread from blocking. Key to understanding why the 92-layer model incurred seconds of TTFT overhead without this fix.

**lmsys-img-004.png — Async Transfer TTFT gains** (load-bearing)

![Bar chart showing TTFT savings from Async Transfer at heavy workloads: up to ~1 second saved versus baseline](../../raw/raindrop/lmsys.org/2026-01-26-optimizing-glm4-moe-for-production-65-fa/lmsys-img-004.png)

Quantifies the magnitude of the transfer scheduling fix — headline numbers in the benchmark section.

- **lmsys-img-005.png / lmsys-img-006.png — Combined TTFT / TPOT benchmark charts** (supporting): show final combined TTFT and TPOT improvements under GLM-4.7 FP8 TP8 production benchmark. Numbers already in Key claims.
- **lmsys-img-001.png / lmsys-img-002.png — Shared Experts Fusion / Qknorm Fusion diagrams** (supporting): architecture schematics for the two kernel fusions. Described in prose.
- **lmsys-img-007.png — Suffix Decoding schematic** (supporting): illustrates the pattern-lookup mechanism. Concept described in prose.

## What this changes

- **Async Transfer is the highest-impact single fix for PD-disaggregated deep models**: for any model with 80+ layers where CUDA Graph isn't used, the stock transfer schedule can waste hundreds of ms per request. The fix is general — not GLM-specific.
- **Suffix Decoding adds a zero-model-weight speculative path** competitive with MTP for agentic coding sessions. The Novita analysis of Claude Code sessions (39.3% pattern repetition) provides empirical grounding for the claim that agentic workloads have unusually high structural repetition, making the technique most valuable in that deployment context.
- **GLM-4.7 serving profile** (TP8 FP8, 92 layers, 160+1 experts) is now concretely benchmarked at production scale on H200 — a reference point for the MoE-on-Hopper deployment space.

## Entities touched

[[SGLang]], [[GLM-4.5]], [[MoE]], [[H200]], [[Speculative Decoding]]

## Topics touched

[[LLM Inference Systems]], [[MoE Serving]]

## Raw source

[lmsys.org/blog/2026-01-21-novita-glm4/](https://lmsys.org/blog/2026-01-21-novita-glm4/) — LMSYS blog post by Novita AI · 7 local images · January 21, 2026. Covers four SGLang optimizations for GLM-4.7 MoE production deployment on H200. Read 2026-05-15.
