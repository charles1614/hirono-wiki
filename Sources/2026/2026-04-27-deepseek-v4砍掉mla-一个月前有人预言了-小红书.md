---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: http://xhslink.com/o/AjcGNDlznfm
tags: [attention-kernels, kv-cache, long-context]
---

# [2026-04-27] DeepSeek V4 砍掉 MLA — 一个月前有人预言了

## TL;DR

An xhs (Xiaohongshu) post by **ViantoZzz** dated 2026-04-27, drawing a tight time-correlation between two events: in early April 2026, researcher **Luo Fuli (罗福莉)** gave a 3.5-hour interview with **Zhang Xiaojun (张小珺)** asserting "MLA has no space left to develop; the field is over-trusting MLA"; ~two weeks later, DeepSeek shipped V4's tech report — [[MLA]] is gone, with no explanation. The author hand-mapped 7 of Luo's interview claims against V4's actual design choices and reports a high hit rate. The post argues the more important signal isn't "prediction verified" but rather: **the field is shifting attention compression's axis from per-token KV compression to compressing which tokens participate at all** — driven by the Agent-era reality that contexts are now framework-injected (millions of tokens) rather than human-typed.

## Key claims

**Seven predictions, all reported as hit by V4** (per the author's hand-comparison):

1. **Long-context efficiency is the first principle** — V4 confirmed ✓
2. **The MLA era is over** — V4 removed MLA ✓
3. **Hybrid attention is the right direction** — V4 adopted ✓
4. **KV cache decides Agent economics** — V4 design centers on this ✓
5. **Architecture must leave compute headroom for MTP** (multi-token prediction) ✓
6. **Post-train compute will catch up to pre-train compute** ✓
7. **Models must be designed for Agent, not Chat** ✓

The author's claim is interpretive — there's no formal verification step, and Luo's interview is in conversational Chinese, so "hit" is a judgment call rather than a numeric match.

**The structural argument is sharper than the prediction-tracking narrative.** When MLA's *inventor* (DeepSeek themselves) walks away from per-token KV compression in favor of **sequence-dimension compression** (i.e. selecting which tokens enter attention at all), it signals a category shift, not an incremental optimization. The author frames it as "from 'how to make each token's KV more compact' to 'how to make fewer tokens participate.'"

**The Agent-era hypothesis.** When context is framework-injected at million-token scale (RAG retrievals, tool-use traces, memory replay) rather than human-typed at hundreds-of-tokens scale, the architectural assumptions of the Chat era no longer hold. **CSA + HCA** (Content Sparse Attention + Hierarchical Compressed Attention, V4's mechanisms per the author) reportedly compress a 1M-token context's KV cache to ~5 GB — opening the door to 10M and 100M context plausibly. The forward question the author flags: at those scales, will attention even look like attention?

## Visual observations

8 hand-made comparison-chart images (see raw archive `69ef4f40000000003501c7b0_01.jpg` through `_08.jpg`). The author claims the images contain a side-by-side table mapping each of Luo's 7 quoted claims against the matching V4 design choice. **Not OCR'd into this Source** — the substantive prediction-vs-outcome mapping is summarized in the text body above; the images are corroborating receipts. Authority on the technical claims should defer to V4's tech report directly, not this xhs author's interpretation layer.

## What this changes

A **quotable second-source confirmation** of a hypothesis already floating in the corpus from [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] and [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] — that MLA's economics get squeezed at the million-token-context frontier. But the *opinion piece* nature is important: this is a curated narrative connecting two real events ([[DeepSeek]] V4's release + Luo's interview), not a technical decomposition. Treat as **signal, not citation** for architectural claims. The CSA + HCA scheme should be verified against DeepSeek's actual V4 tech report when it's ingested into the wiki.

Open thread for [[Attention Kernels]]: if sequence-dimension compression supplants per-token KV compression as the field's dominant compression axis, FlashMLA's design point (which optimizes the per-token-KV decode kernel) gets relativized. What does the analogous kernel for CSA+HCA look like?

## Raw source

> Platform: Xiaohongshu (xhs) · 作者: ViantoZzz · 互动: 485 likes · 608 collects · 17 comments
> Quoted interview: Luo Fuli (罗福莉) × Zhang Xiaojun (张小珺), early April 2026 · 3.5 hours
> Source identifiers (raw): `69ef4f40000000003501c7b0` (xhs note ID); 8 images preserved as `<note_id>_01..08.jpg`
> Related corpus: [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]], [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
