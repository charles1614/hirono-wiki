---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/
tags: [tpu, inference, google, accelerator, hardware]
---

# [2026-01-12] Ironwood: The first Google TPU for the age of inference

## TL;DR

[[Google]]'s seventh-generation [[TPU]] (Ironwood, formerly known internally as TPU v7), announced at Cloud Next '25 — the first generation **explicitly designed for inference**, not training. Headline numbers: 4,614 TFLOPs/chip, 192 GB HBM/chip (6× Trillium), 7.37 TB/s HBM bandwidth (4.5× Trillium), 2× perf/watt vs Trillium, scales to 9,216-chip pods at 42.5 EFLOPS. Marks Google's framing of "age of inference" — inference-optimized accelerators are now a distinct product line, not a derivative of training silicon.

## Key claims

- "Age of inference" framing: the workload mix is shifting from *responsive* models (people consume real-time results) to *proactive* models (agents fetch + generate to deliver insights). The accelerator design responds to that workload.
- Pod scale: 256-chip or 9,216-chip configs. 9,216 chips × 4,614 TFLOPs = 42.5 EFLOPS — Google explicitly positions this as **24× El Capitan** (1.7 EFLOPS), the world's largest supercomputer.
- Per-chip: 4,614 TFLOPs peak, 192 GB HBM (6× Trillium), 7.37 TB/s HBM bandwidth (4.5× Trillium), 1.2 TB/s bidirectional ICI (1.5× Trillium).
- 2× perf/watt vs Trillium (TPU v6); ~30× perf/watt vs the first Cloud TPU (2018).
- Liquid-cooled; nearly 10 MW per pod.
- Co-designed with [[Pathways]] (Google's distributed ML runtime, originally a DeepMind paper) — Pathways is what lets a workload span tens of thousands of Ironwood chips transparently.
- Enhanced [[SparseCore]] for ultra-large embeddings — extends use cases beyond LLMs into ranking/recommendation, financial, scientific workloads.
- FP8 is "natively supported" on Ironwood; on v4/v5p the FP8 numbers were *emulated*. So FP8 is now a first-class precision on TPU, not just GPU.
- Workload examples called out: Gemini 2.5, AlphaFold.

### TPU spec progression — reproduced from Fig 1 in raw (img-003)

The single most useful artifact in the post. Reproduced verbatim from the rendered
figure (refetched after the srcset / blog.google `data-loading` fix landed in
commit `<this commit>` — original capture had 1.4 KB thumbnail).

| Spec | TPU v4 (2022) | TPU v5p (2023) | **Ironwood (2025)** | v4 → Ironwood |
|---|---|---|---|---|
| Pod Size (chips) | 4,096 | 8,960 | 9,216 | 2.25× |
| HBM | 32 GB @ 1.2 TB/s | 95 GB @ 2.8 TB/s | **192 GB @ 7.4 TB/s** | 6× cap / 6× BW |
| Peak TFLOPS per chip | 275 | 459 | **4,614** | **16.8×** |

Note: the body's perf-ratio claims are against *Trillium* (TPU v6), absent from this
chart. The chart's *v4 vs Ironwood* comparison is much more dramatic — 17× peak
flops/chip in one generation gap.

### Ironwood — additional absolutes from body text

| Spec | Ironwood | Source ratio |
|---|---|---|
| ICI bidirectional bandwidth | 1.2 TB/s | 1.5× vs Trillium |
| Perf/watt vs Trillium | — | 2× |
| Perf/watt vs TPU v1 (2018) | — | ~30× |
| 9,216-chip pod peak (FP8) | 42.5 EFLOPS | claimed 24× El Capitan |
| 9,216-chip pod power | ~10 MW | — |

## Visual observations

- **Fig 1 — TPU spec progression** (`blog-google-img-003.webp`, now 50 KB after
  CDN-upgrade fix). v4 / v5p / Ironwood spec table with photo headers + absolute
  numbers reproduced verbatim above. The 275 → 459 → 4,614 TFLOPS/chip progression
  is the headline takeaway the body buries — body only quotes Ironwood's 4,614.

- **Fig 2 — Peak FP8 perf/watt across all 6 generations** (`blog-google-img-004.webp`,
  now 15 KB). Bar chart with explicit ratios (TPU v2 = 1.0 baseline):
  v2=1.0 → v3=1.8 → v4=4.9 → v5p=5.2 → **Trillium=14.6** → **Ironwood=29.3**.
  Confirms the body's "2× Trillium" claim exactly (29.3 / 14.6 = 2.01×) and the
  "~30× TPU v1" claim (off by one — likely 30× vs *first Cloud TPU 2018* which is
  v2 in this chart). Surfaces a new number: v5p → Ironwood is **5.6×**.

- **Fig 3 — Peak FP8 flops growth chart** (`blog-google-img-002.webp`) —
  ❌ download failed (the `width-1000` variant returns 403 on Google's CDN; only
  `width-500` and `width-100` exist for this image). Flagged as
  `blog-google-image-download-partial`. Recoverable with a targeted refetch
  using `width-500` instead — added to follow-up.

- **Fig 0 — event logo** (`blog-google-img-001.webp`, 6 KB) — Google Cloud Next 25
  marketing image, decorative; no info content. Skip.

## Entities touched

[[Google]], [[TPU]], [[Trillium]], [[Pathways]], [[SparseCore]], [[Gemini]], [[AlphaFold]]

## Topics touched

[[Inference-Optimized Accelerators]], [[Training Infrastructure]], [[Low-Precision Training]]

## Open questions

- "Inference-first" is a marketing framing — but Ironwood is also positioned for training ("most demanding training and serving"). Where does the inference-vs-training trade-off actually show up in the architecture? (Likely HBM capacity at the expense of compute density vs Trainium3 / Blackwell?)
- 24× El Capitan claim is apples-to-oranges (FP8 TFLOPS vs HPC-style FP64 EFLOPS — El Capitan is 1.7 EFLOPS *FP64*). At FP8 the comparison is much closer; the marketing pitch obscures this.
- 2× perf/watt vs Trillium is the headline efficiency claim — interesting baseline because Trillium itself was 2× v5p. Compounding generation-over-generation gains, not a one-shot jump.
- How does Ironwood compete with [[Trainium3]] and [[NVIDIA]] Rubin on a $/inference-token basis? The blog gives perf/watt, not perf/$. (Cross-source with [[2026-05-08-a-survey-of-llm-inference-systems]].)
- SparseCore is called out for finance + science — concrete workloads? Recsys is implied (ranking embeddings) but the science angle is new.

## Raw source

[blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference](https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/) — full post, 8.5 KB body + 4 figures (TPU lineage charts).
