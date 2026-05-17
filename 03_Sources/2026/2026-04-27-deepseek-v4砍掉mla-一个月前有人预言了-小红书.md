---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: http://xhslink.com/o/AjcGNDlznfm
tags: [attention-kernels, kv-cache, long-context]
---

# [2026-04-27] DeepSeek V4 砍掉 MLA — 一个月前有人预言了

## TL;DR
the
An xhs (Xiaohongshu) post by **ViantoZzz** (2026-04-27) drawing a tight time-correlation between two events: in March 2026, researcher **Luo Fuli (罗福莉)** gave an interview with **Zhang Xiaojun (张小珺)** asserting "[[MLA]] has no space left to develop; the field is over-trusting MLA"; on 2026-04-24, **DeepSeek shipped V4's tech report — MLA is gone**, with no explanation. The author hand-built 8 image panels mapping Luo's interview claims against V4's actual design choices on 7 technical dimensions, citing specific V4 §-references and quantitative receipts. The post's *prose body* is a thin caption-and-framing layer (~50 lines); the *substance lives in the images*. The author's argument is that the predictions hit because both Luo and the V4 design team start from the same first principle — **long-context efficiency dominates the architecture decision tree**. The bigger signal: the field is shifting attention compression from "compress each token's KV" toward "compress which tokens participate at all."

## Key claims

Each of the 7 numbered comparison panels in the image gallery follows the same layout: **Luo quote (2026-03 interview)** → **matching V4 tech-report §-citation** → **analyst note**. Specifics extracted from the panels:

**1. Long Context — KV cache efficiency (panel 01, V4 §3.6.2).**
Luo claim: long-context KV cache economics are the load-bearing constraint at 1M-token scale. V4 receipt: **DeepSeek-V4-Pro requires only 27% of single-token inference FLOPs and 10% of KV cache compared with DeepSeek-V3.2** at the 1M-token context setting. The mechanism named in the panel: **Compression Sparse Attention** (CSA), first appearance in a DeepSeek architecture; also references MLP Router + Token Scaling as adjacent V4 innovations.

**2. MLA retirement (panel 02, attention architecture).**
Luo claim: "MLA 没有任何可发挥的空间... 大家太相信 MLA 了." V4 receipt: **MLA is removed**; V4 returns to MHA + GQA primitives, with sparse + sliding mechanisms layered on top. The analyst note frames this as the architectural lineage MHA → QKV-aligned → GQA → MLA reaching a dead end at MLA — V4's choice is rollback-and-rebuild, not incremental.

**3. Hybrid Attention (panel 03, attention composition).**
Luo claim: hybrid combinations of MHA / GQA / Sliding Window Attention are the right next direction. V4 receipt: V4 composes **MHA globally + GQA grouped + Sliding Window locally** with Sparse Attention + Flash Attention optimizations on top. The panel cites V4 §2.3 and §5.4 for the hybrid-composition specifics.

**4. On-disk KV Cache (panel 04, V4 §3.6.2 + V4 §3.3.2).**
Luo claim: in Agent and multi-step reasoning workflows, KV cache efficacy directly governs throughput + latency. V4 receipt verbatim from the image: "**We leverage an on-disk KV cache storage mechanism to eliminate repeated prefill for shared-prefix requests** ... simply store all of the compressed KV values on a local SSD." The analyst frames this as V4 making the engineering choice to push KV cache to SSD storage explicitly for high-concurrency Agent workloads — trading SSD-bandwidth for GPU-memory pressure.

**5. MTP — Multi-Token Prediction (panel 05, V4 §3.3.3 / Multi-Token Progression).**
Luo claim: the architecture must leave compute headroom for MTP at inference time. V4 receipt: V4 carries over MTP from V3.1 — "DeepSeek-V4 series also use MTP modules and objectives. These are aligned to multi-token prediction training strategies for DeepSeek-V3.1." The implementation depth and the relationship to V4's Speculative Decoding path is in the same panel.

**6. Post-train compute parity (panel 06, V4 §3.5 Post-Training).**
Luo claim: Post-train compute will catch up to (or pass) pre-train compute. V4 receipt: the V4 post-training framework explicitly does **Scaling RL Framework for Million-Token Instruction-for-Agentic-AI**, evaluated across hundreds of sandbox-level instruction-tuning sets. The panel doesn't quote the exact compute-ratio but frames the design as treating post-train as a co-equal scaling axis to pre-train.

**7. Chat vs Agent (panel 07, V4 design philosophy).**
Luo claim: "Chat 与 Agent 不是对立的，而是同一套基础设施在不同场景下的映射." V4 receipt verbatim: "The agentic pattern that scales through complex agentic workflows to maximize cross-domain task diversity ... establishes useful constraints for enabling future research with long-horizon tasks." The analyst's framing: V4 chooses *fusion not separation* — one model serves Chat and Agent via unified Context handling / Attention mechanism / Token Scaling, rather than forking the architecture.

## Visual observations

*No load-bearing images — all images text-only (typed content extracted into body).*

## What this changes

A **second-source confirmation** of a hypothesis already floating in the corpus from [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] and [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] — that [[MLA]] economics get squeezed at the million-token-context frontier. With one important caveat: this is an *interpretation piece*, not the V4 tech report directly. The §-citations are extracted from the panel images; the actual V4 paper should be the primary citation once it lands in the corpus. **Treat the specific §-numbers as receipts to verify against V4's paper, not as primary evidence.**

Updates [[Attention Kernels]] with a forward question: if sequence-dimension compression (CSA + on-disk KV) supplants per-token KV compression as the dominant axis, [[FlashMLA]]'s design point (optimizing the per-token-KV decode kernel) gets relativized. What does the analogous kernel for CSA + on-disk KV look like? Does it stay GPU-resident or include an SSD-bandwidth-aware scheduling layer?

Updates [[DeepSeek]] entity with the V4 architectural pivot — MLA's inventor walking away from MLA is itself the story, regardless of whether the specific 27% / 10% / 1:7 numbers survive verification.

## Raw source

> Platform: Xiaohongshu (xhs) · 作者: ViantoZzz · 互动: 485 likes · 608 collects · 17 comments
> Quoted interview: Luo Fuli (罗福莉) × Zhang Xiaojun (张小珺), early March 2026
> V4 tech report release: 2026-04-24
> Source identifiers (raw): `69ef4f40000000003501c7b0` (xhs note ID); 8 image panels preserved as `<note_id>_01..08.jpg` (~160-200 KB each, gold-on-black design)
> Image extraction: Opus-eye pass during pre-flight (see image-extract sibling `<slug>-images-extract.md` for Haiku's first-pass structural skeleton — kept for audit; numerical specifics in the Source body are the Opus reading)
> Related corpus: [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]], [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
