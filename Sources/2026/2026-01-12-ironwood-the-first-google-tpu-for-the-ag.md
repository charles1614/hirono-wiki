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

- **Cloud_Collection_SS** (decorative header image): supporting, not load-bearing.
- **Fig 1 — FP8 peak flops relative to v2** (bar chart): visualizes per-chip generational throughput growth. Supports the "30× efficiency" claim by showing the compute-density trajectory.
- **Fig 2 — Side-by-side 3D-torus TPU spec comparison** (load-bearing as reference, but no local image to inline): the table this implies covers v4, v5p, v6 (Trillium), v7 (Ironwood). FP8 emulated on v4/v5p, native on Ironwood. Same shape as the cross-gen table in [[2026-01-09-google-tpus-explained-architecture-perfo]].
- **Fig 3 — Power efficiency vs v2** (bar chart): the 30× perf/W claim visualized.

(Source: blog.google delivered images as `.webp`; raw archive flags `blog-google-image-download-partial` — see open questions.)

## What this changes

- **Establishes Ironwood as official**. The IntuitionLabs report ([[2026-01-09-google-tpus-explained-architecture-perfo]]) relies on third-party analyst numbers; this is Google's primary-source confirmation of 4,614 TFLOPS, 192 GB HBM, 9,216-chip pods, 42.5 EFLOPS, 2× perf/W over Trillium. Treat as canonical.
- **El Capitan claim** is the rhetorical anchor. "24× El Capitan" gives non-experts a scale comparison. (Caveat: El Capitan is a general-purpose HPC system; Ironwood is AI-specific. The comparison is not apples-to-apples on workloads outside dense linear algebra + collective comm.)
- **FP8 native on Ironwood** removes the emulation tax Trillium and v5p paid. Combined with 192 GB HBM, large-context inference (1M+ tokens for Gemini 3) becomes economically tractable.
- **Pairs with**: [[2026-01-09-google-tpus-explained-architecture-perfo]] (third-party analysis with cross-gen context; Ironwood numbers confirmed here are stated as projections there).

## Entities touched

[[Google]], [[TPU]], [[Ironwood]], [[Trillium]], [[Pathways]], [[SparseCore]], [[ICI]], [[HBM]], [[Gemini 2.5]], [[AlphaFold]], [[AI Hypercomputer]], [[El Capitan]]

## Topics touched

[[AI Accelerators]], [[LLM Inference Systems]], [[FP8 Computation]], [[Power Efficiency]], [[Accelerator Economics]]

## Open questions

- The raw fetch is `blog-google-image-download-partial` (4 image refs were declared but downloading them was incomplete). The four figures referenced in the body (`blog-google-img-001..004.webp`) — are they all present locally? Should re-fetch with image rules tightened.
- Native-FP8 vs emulated-FP8 — what's the practical perf delta on real workloads (e.g. LLaMA 405B inference)? Useful for comparing Ironwood's listed FLOPS to "real workload throughput."
- Ironwood's claim "24× El Capitan" — the metric is total FLOPS but accelerator-only. El Capitan's 1.7 EFLOPS is FP64. Ironwood's 42.5 EFLOPS is FP8. **Different precisions, not directly comparable** without normalization. Worth flagging.
- "9,216 chips" — peculiar number. Likely `1024 × 9` or factor of 768. Why this specifically? Bisectional-bandwidth fits at this scale?
- Available power as "one of the constraints" — does Ironwood + AI Hypercomputer become a competitive moat against Nvidia, or does Nvidia + grid-power-PPA close the gap?

## Raw source

[blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/](https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/) — ~5 KB body + 4 images. Published Apr 9 2025, updated Apr 23 2025. Read 2026-05-11. (raw flag: `blog-google-image-download-partial`)
