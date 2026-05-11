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

### Ironwood vs Trillium — load-bearing spec table

Reproduced verbatim from the body text (post doesn't include this as a single
table; reconstructed because the comparison ratios + absolute values for
Ironwood are scattered across bullets and read more clearly as a grid):

| Spec | Ironwood (TPU v7) | Ratio vs Trillium (v6) |
|---|---|---|
| Peak TFLOPS (FP8, **native**, not emulated) | 4,614 | (Trillium FP8 was emulated) |
| HBM capacity | 192 GB | 6× |
| HBM bandwidth | 7.37 TB/s | 4.5× |
| ICI bidirectional bandwidth | 1.2 TB/s | 1.5× |
| Perf/watt | (absolute not stated) | **2×** |
| Perf/watt vs TPU v1 (2018) | — | ~30× |
| Pod configurations | 256 chip / 9,216 chip | — |
| 9,216-chip pod peak (FP8) | 42.5 EFLOPS | — |
| 9,216-chip pod power | ~10 MW | — |

## Visual observations

*Not populated — the four images in `raw/.../*.webp` are 1.1–6.3 KB
responsive-image thumbnails (Google's CDN served us the small-viewport variant,
not the readable figure). Img-001 is the Cloud Next 25 event logo (decorative);
img-002 is the "FP8 peak flops" bar chart but text is illegible at the captured
resolution; img-003 is the v4/v5p/Ironwood spec table screenshot also illegible;
img-004 is the perf/watt bar chart, same problem. **Fetcher gap captured as
a follow-up TODO** — `_default`/article-site-factory should prefer the
largest `srcset` candidate, not the inline `src`. Body text already carries
the headline numbers; ingesting from images would not change Key Claims here.*

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
