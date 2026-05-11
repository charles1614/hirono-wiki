---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/
tags: [tpu, ironwood, google, inference, ai-hypercomputer, pathways, sparsecore]
---

# [2026-01-12] Ironwood — The First Google TPU for the Age of Inference

## TL;DR

Google Cloud Next '25 announcement (Apr 9 2025, updated Apr 23) of **Ironwood**, the **7th-generation TPU and Google's first inference-first chip**. The framing positions a generational pivot from "responsive AI" (real-time answers) to **"age of inference" / "thinking models"** (proactive agents that retrieve and generate insights). Two configurations: **256 chips** (entry) and **9,216 chips** (top — 42.5 Exaflops/pod, ~10 MW, liquid-cooled, claimed 24× El Capitan supercomputer). Per chip: **4,614 TFLOPS FP8, 192 GB HBM (6× Trillium), 7.37 TB/s HBM bandwidth (4.5× Trillium), 1.2 TBps bidirectional ICI (1.5× Trillium), 2× perf/watt over Trillium**. Pathways software stack lets hundreds-of-thousands of chips compose across pods.

## Key claims

- **The "age of inference" framing**: Google's headline philosophical move — AI is shifting from real-time response to proactive agents that retrieve+generate. Ironwood is built for "thinking models" (LLMs, MoEs, advanced reasoning). The architectural implication is **massive parallel processing + efficient memory access + low-latency intra-pod comm**.
- **Two pod sizes**:
  - **256 chips** — entry, single-pod inference / smaller training.
  - **9,216 chips** — **42.5 Exaflops/pod**, "more than 24× the compute of El Capitan" (currently world's largest supercomputer at 1.7 EFLOPS).
- **Per-chip Ironwood specs**:
  - **4,614 TFLOPS FP8** peak compute.
  - **192 GB HBM** per chip — **6× Trillium**. Critical for context-heavy inference.
  - **7.37 TB/s HBM bandwidth** — **4.5× Trillium**. Eliminates HBM-bandwidth as bottleneck.
  - **1.2 TBps bidirectional ICI** — **1.5× Trillium**. Faster intra-pod synchronous comm.
  - **2× perf/watt vs Trillium**.
- **~30× more power efficient than v2 (the first Cloud TPU, 2018)**. Power is now an explicit constraint: "available power is one of the constraints for delivering AI capabilities" — Ironwood's perf/W is framed as economic positioning.
- **Native FP8 support** — Ironwood's FP8 is native, vs v4 and v5p which emulated FP8 (Fig 2 in the source).
- **SparseCore enhanced** — specialized accelerator for ultra-large embeddings. Expanded scope beyond traditional AI (ranking/recommendation) to **financial and scientific** workloads. Suggests Google is positioning Ironwood for HPC-adjacent uses too.
- **Pathways** (Google DeepMind's ML runtime) is the cross-pod scaling primitive — composes hundreds of thousands of chips across multiple Ironwood pods. Pathways was unveiled in 2022; Ironwood is the chip it was always pointing toward.
- **Liquid cooling** is mandatory at 10 MW pod scale. "Reliably sustain up to 2× the performance of standard air cooling under continuous heavy AI workloads."
- **Production workloads as of announcement**: Gemini 2.5 and AlphaFold run on TPUs today. Ironwood "available later this year" (i.e. late 2025 — and per [[2026-01-09-google-tpus-explained-architecture-perfo]], Ironwood reached GA Nov 2025 and is now powering Gemini 3 production).

## Visual observations

**Figure 1 — FP8 peak flops vs TPU v2** (load-bearing — visualizes the generational compute-density trajectory)

![Green bar chart showing progressive improvement in FP8 peak performance from TPU v2 (baseline) through v4, v5p, v6 (Trillium), to v7 (Ironwood) — the per-chip throughput curve underlying the 30× perf/W claim](../../raw/raindrop/blog.google/2026-01-12-ironwood-the-first-google-tpu-for-the-ag/blog-google-img-002.webp)

The numbers in the abstract become concrete here. The progressive bars show Ironwood's per-chip FP8 leap is not an incremental refresh — it's a structural step.

**Figure 2 — Side-by-side TPU spec comparison (v4 / v5p / Trillium / Ironwood)** (load-bearing reference)

![Side-by-side illustration of recent 3D-torus Cloud TPUs (v4, v5p, v6 Trillium, v7 Ironwood) with details like peak flops per chip, HBM capacity, interconnect bandwidth. Note: FP8 is emulated on v4 and v5p but natively supported on Ironwood](../../raw/raindrop/blog.google/2026-01-12-ironwood-the-first-google-tpu-for-the-ag/blog-google-img-003.webp)

The canonical cross-gen specs as Google publishes them. Mirror of the cross-gen table in [[2026-01-09-google-tpus-explained-architecture-perfo]] but from the primary source.

**Figure 3 — TPU power efficiency vs v2** (load-bearing — the 30× perf/W trajectory)

![Green bar chart showing TPU power efficiency improvement from v2 baseline through each generation to Ironwood, measured as peak FP8 flops delivered per watt of TDP per chip package](../../raw/raindrop/blog.google/2026-01-12-ironwood-the-first-google-tpu-for-the-ag/blog-google-img-004.webp)

The "30× more efficient than v2" claim visualized. This is the chart that anchors Google's positioning that perf/W is widening the gap vs merchant-silicon GPUs.

- **Cloud_Collection_SS** (decorative header at `blog-google-img-001.webp`): supporting, not load-bearing.

## What this changes

- **Establishes Ironwood as official**. The IntuitionLabs report ([[2026-01-09-google-tpus-explained-architecture-perfo]]) relies on third-party analyst numbers; this is Google's primary-source confirmation of 4,614 TFLOPS, 192 GB HBM, 9,216-chip pods, 42.5 EFLOPS, 2× perf/W over Trillium. Treat as canonical.
- **El Capitan claim** is the rhetorical anchor. "24× El Capitan" gives non-experts a scale comparison. (Caveat: El Capitan is a general-purpose HPC system; Ironwood is AI-specific. The comparison is not apples-to-apples on workloads outside dense linear algebra + collective comm.)
- **FP8 native on Ironwood** removes the emulation tax Trillium and v5p paid. Combined with 192 GB HBM, large-context inference (1M+ tokens for Gemini 3) becomes economically tractable.

## Entities touched

[[Google]], [[TPU]], [[Ironwood]], [[Trillium]], [[Pathways]], [[SparseCore]], [[ICI]], [[HBM]], [[Gemini 2.5]], [[AlphaFold]], [[AI Hypercomputer]], [[El Capitan]]

## Topics touched

[[AI Accelerators]], [[LLM Inference Systems]], [[FP8 Computation]], [[Power Efficiency]], [[Accelerator Economics]]

## Raw source

[blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/](https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/) — ~5 KB body + 4 images (header + 3 figures). Published Apr 9 2025, updated Apr 23 2025. Initial fetch had `blog-google-image-download-partial` (img-002 truncated to 1.1 KB); refetched 2026-05-11, all 4 images now full-size, flag cleared, status=good.
