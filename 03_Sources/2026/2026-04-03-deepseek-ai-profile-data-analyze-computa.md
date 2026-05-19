---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://github.com/deepseek-ai/profile-data
tags: [inference, training, moe, comm-overlap, observability]
---

# [2026-04-03] deepseek-ai/profile-data — DeepSeek V3/R1 profile traces with computation-communication overlap

## TL;DR

**DeepSeek publishes the actual PyTorch Profiler traces** for V3/R1 training + inference (prefill + decode) so the community can inspect the **computation-communication overlap strategies** at trace level. The repo is a 3-trace bundle (`train.json` + `prefill.json` + `decode.json`) viewable via `chrome://tracing`. The 3 inlined timeline schematics are the architectural summary — they show **which SMs run compute vs which SMs run communication** in each regime, color-coded by forward/backward chunk (training) or micro-batch 0/1 (inference). This is the "publish-the-receipts" pattern in [[DeepSeek]]'s open-infra series (cf. [[FlashMLA]], DeepEP, DualPipe).

## Key claims

**Training profile** (`train.json`, `EP64 / TP1 / seq_len=4K`):

- **Two-chunk overlap via [[DualPipe]]**: each forward+backward chunk contains 4 MoE layers; the trace visualizes one F+B pair.
- **SM partitioning**: 112 SMs allocated to compute (MLP B/W/F + ATTN B/W/F), 20 SMs to communication (Dispatch F/B + Combine F/B + PP F/B). The 112+20 split is the explicit hardware-resource-budgeting decision.
- **Cross-chunk dependency arrows** in the diagram show how MLP-(B/W/F) → Dispatch → ATTN → Combine chains interleave between F and B chunks.
- **PP communication excluded from trace** for simplicity (the real deployment includes it).
- **Absolutely balanced MoE routing simulated** for the profile — real production routing is not perfectly balanced, but the simulation isolates the overlap-pattern from the load-imbalance signal.

**Prefill profile** (`prefill.json`, `EP32 / TP1 / prompt=4K / batch=16K tokens/GPU`):

- **108 SMs compute / 24 SMs communication** — different split than training (slightly less compute headroom, more comm).
- **Two-micro-batch overlap** between compute (ATTN + SHARED + MLP) and AlltoAll-style comm (COMBINE + DISPATCH).
- **Attention computation load balanced across the two micro-batches** — "the same prompt may be split between them" — a deliberate scheduling choice to keep both compute lanes saturated.
- **ATTN block contains "MLA and MoE routing gate"** (caption in image). SHARED = shared experts. The schematic preserves the MLA+MoE separation.

**Decode profile** (`decode.json`, `EP128 / TP1 / prompt=4K / batch=128 requests/GPU`):

- **EP128** — much wider EP than prefill (EP32), reflecting decode's affinity for large EP groups (each token visits its assigned expert; more parallelism is good when each token-step is cheap).
- **Same two-micro-batch overlap pattern** but the critical difference: **decode's AllToAll does NOT occupy GPU SMs** — after RDMA messages are issued, all SMs are freed; the system waits for AllToAll completion only after compute finishes.
- **Implementation reference**: [DeepEP](https://github.com/deepseek-ai/DeepEP) for the SM-freeing AllToAll mechanism.

The three traces together are **a 2026 baseline** for "what well-overlapped DeepSeek-V3/R1 production scheduling looks like." Anyone implementing an alternative MoE-serving stack can diff their traces against these to spot overlap-opportunity gaps.

## Visual observations

3 timeline-schematic diagrams illustrate the SM-lane partitioning + overlap pattern for each regime. All real visual content (boxes + arrows + color-coded micro-batch / chunk identity); spatial structure resists text expression.

**Training trace summary** (`https://hirono-wiki.litenext.digital/raindrop/github.com/2026-04-03-deepseek-ai-profile-data-analyze-computa/github-img-001.jpg`)

![Training-profile timeline: 112 SMs compute lane (MLP B/W/F + ATTN B/W/F boxes alternating, color-coded by forward chunk orange vs backward chunk green) interleaved via dependency arrows with 20 SMs communication lane (Dispatch F/B + Combine F + PP F/B + Combine B)](https://hirono-wiki.litenext.digital/raindrop/github.com/2026-04-03-deepseek-ai-profile-data-analyze-computa/github-img-001.jpg)

The SM-lane partitioning is the load-bearing insight: 112+20=132 SMs assigned at the deployment level, not the kernel level. Compute and communication run on disjoint SM pools rather than serializing.

**Prefill trace summary** (`https://hirono-wiki.litenext.digital/raindrop/github.com/2026-04-03-deepseek-ai-profile-data-analyze-computa/github-img-002.jpg`)

![Prefill timeline: 108 SMs compute lane (ATTN + SHARED + MLP boxes color-coded by micro-batch 0 vs 1) interleaved with 24 SMs communication lane (COMBINE + DISPATCH alternating). Caption: "ATTN: MLA and MoE routing gate · SHARED: Shared experts"](https://hirono-wiki.litenext.digital/raindrop/github.com/2026-04-03-deepseek-ai-profile-data-analyze-computa/github-img-002.jpg)

The two-micro-batch overlap pattern for prefill — same SM-lane partitioning logic as training, different lane sizes.

**Decode trace summary** (`https://hirono-wiki.litenext.digital/raindrop/github.com/2026-04-03-deepseek-ai-profile-data-analyze-computa/github-img-003.jpg`)

![Decode timeline showing two-micro-batch overlap with EP128 / TP1 configuration; AllToAll communication does not occupy SMs (RDMA-issued, then SMs freed)](https://hirono-wiki.litenext.digital/raindrop/github.com/2026-04-03-deepseek-ai-profile-data-analyze-computa/github-img-003.jpg)

Decode's SM-freeing AllToAll is the architectural commitment that makes EP128 viable — without it, communication would block compute and the EP-scale benefit would invert. References DeepEP for the mechanism.

## What this changes

A **publicly inspectable receipt** for DeepSeek's overlap strategy across all three regimes. Updates:

- [[MoE Serving]]: confirms the SM-lane partitioning approach (compute SMs disjoint from comm SMs) as production-validated at EP32-EP128 scale.
- [[Inference Disaggregation]]: the prefill vs decode SM split (108+24 vs decode's freed-SM AllToAll) is the architectural justification for treating them as separate pools — confirms the "lopsided" framing from [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] in concrete trace form.
- [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] (Ant H20-96G recipe) draws on DualPipe + DeepEP — this Source is the trace-level evidence those frameworks are built around.

**Open thread**: do the published traces include the OPENING and CLOSING phases of each forward/backward chunk, or only the steady-state interior? Steady-state-only traces hide the warmup overhead, which can dominate at small batch sizes. Worth inspecting the JSON directly if it becomes load-bearing.

## Raw source

> Host: github.com · Repo: `deepseek-ai/profile-data` · ~MIT-style open share
> Tool to view: `chrome://tracing` (or `edge://tracing`)
> Three JSON traces: `train.json`, `prefill.json`, `decode.json` (not in raw archive — download from the repo)
> Related corpus: [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] (decode kernel), [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] (disagg framing), [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] (production recipe)
