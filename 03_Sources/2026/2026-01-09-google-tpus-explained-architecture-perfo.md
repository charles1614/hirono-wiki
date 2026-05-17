---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://intuitionlabs.ai/pdfs/google-tpus-explained-architecture-performance-for-gemini-3.pdf
tags: [tpu, accelerator-design, survey]
---

# [2026-01-09] Google TPUs Explained — Architecture & Performance for Gemini 3

## TL;DR

IntuitionLabs technical report (Dec 19 2025, revised Apr 17 2026, 16 pp, 35-min read) walking through **all seven TPU generations (v1 → v7 / Ironwood)** with architectural specs, performance vs. Nvidia GPUs, and Gemini-3's reliance on TPU v5e/v6e for training/inference. **Headline framing: Gemini 3 was trained and is served *entirely* on TPUs**, marking Google's strategic break from third-party GPU dependence. Key efficiency claims: TPU v4 pods deliver 1.2-1.7× higher throughput than equivalent A100 pods at **53-77% of the power**; TPU v6e (Trillium) was the chip behind Gemini 2.0 — 4.7× peak per chip vs v5, +67% efficiency, 100K-chip pods on 13 Pbps Jupiter fabric. **Ironwood (v7x, GA Nov 2025) is the "inference-first" generation** at projected ~4.6 PFLOPS/chip + 192 GB HBM, 9,216-chip pods @ ~42.5 EFLOPS per pod, powering Gemini 3 production inference.

## Key claims

- **TPU generations at a glance** (Table 1 in the source, paraphrased):

  | Gen | Year | Role | Peak/chip | Memory | Pod | Notable |
  |---|---|---|---|---|---|---|
  | v1 | 2015-17 | Inference | 92 TOPS (int8) | 28 MB on-chip | 16-32 chips/machine | 256×256 systolic array; 15-30× faster, 30-80× TOPS/W vs contemporary GPUs |
  | v2 | 2017 | Train+Infer | ~45 TFLOPS (BF16) | ~8 GB HBM | 64 boards = 11.5 PFLOPS | Introduced bfloat16, liquid cooling |
  | v3 | 2018 | Training | 420 TFLOPS/board | 128 GB/board | 1024 chips ~100 PFLOPS | Record MLPerf times |
  | v4 | 2020 | Both | ~1 PFLOPS (BF16) | ≥128 GB/board | 4096 chips via OCS | **Optical Circuit Switches (5-D torus)**; SparseCores (5% die, 5-7× embedding speedup); 2.1× perf, 2.7× perf/W over v3 |
  | v5e/v5p | 2023 | Infer / Train | 393 TOPS (int8) | varies | 256-chip pod = 100 PETA-OPS | v5e: 2.5× perf/$ vs v4 inference, 1.7× lower latency |
  | v6e (Trillium) | 2024 GA | Both | 4.7× v5 peak | 2× v5 HBM | 100K chips/pod @ 13 Pbps Jupiter | +67% efficiency; trained Gemini 2.0; host-memory offload |
  | v7x (Ironwood) | 2025 GA | Infer + Train | **~4,614 TFLOPS** (rumored) | **192 GB/chip** | **9,216 chips/pod ~42.5 EFLOPS** | **Inference-first** design; powering Gemini 3 production |
- **TPU architecture invariants** (consistent across generations):
  - **Large systolic array** is the load-bearing primitive (v1 256×256 → projected billions of MACs on v7).
  - **No out-of-order execution, no deep cache** — static deterministic pipeline. Trades flexibility for predictable 99th-pct latency + high MAC-utilization.
  - **On-chip Unified Buffer + weight FIFO** feeds the array from HBM.
  - **bfloat16** for training (introduced v2); INT8/INT4 for inference (v5e onward).
- **Three TPU-distinctive innovations** vs typical GPUs:
  1. **Optical Circuit Switches (v4+)** — dynamic 5-D torus fabric reconfiguration. <5% of pod cost, <3% of pod power. Enables 4096+ chip pods.
  2. **SparseCores (v4+)** — small dataflow units (~5% of die) for embedding lookups → 5-7× speedup on embedding-heavy models.
  3. **Jupiter fabric (v6e)** — packet-routed fabric, **100K chips at 13 Pbps bisectional bandwidth**.
- **AI Hypercomputer** = vertical stack: TPU silicon + Jupiter fabric + XLA/JAX/Pathways compiler stack. Co-designed end-to-end. Gemini 3 explicitly trained on this stack, not GPUs.
- **Quantitative comparisons vs GPUs**:
  - **TPU v4 vs A100 pod**: 1.2-1.7× throughput at 53-77% power.
  - **TPU v4 vs Graphcore IPU Bow**: 4.3-4.5× throughput (similar cluster size).
  - **TPU v5e vs v4 (inference)**: 2.5× perf/$, 1.7× lower latency.
  - **TPU v6e vs v5 (training)**: ~4× perf, +67% efficiency.
  - **TPU v4 vs on-prem GPU server (datacenter-wide energy)**: ~3× less electricity, ~20× lower CO₂ for equivalent training.
- **Customer case-study numbers**:
  - **AssemblyAI**: 4× throughput/$ on TPU v5e for speech AI.
  - **Gridspace**: 5× training speedups.
- **Gemini 3 commercial pricing**: $2 / $12 per MTok (input/output), with Gemini 3.1 Pro now succeeding it as current flagship. Gemini 3 Flash at $0.50.
- **Ironwood-specific projections** (analysts, unconfirmed by Google):
  - ~4.6 PFLOPS/chip mixed-precision.
  - 192 GB HBM/chip.
  - 9,216-chip pods → ~42.5 EFLOPS per pod.
  - ~30× the original v1 power efficiency.
  - **"Inference-first"** — designed for trillions of real-time queries (vs v6e's training-first orientation).

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

For Google's own visual artifacts (FP8-perf bar chart, TPU spec card, perf/W bar chart), see [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]].

## What this changes

- **For the GPU vs TPU debate**: the report makes the strongest case yet for TPU's competitive position. Gemini 3 trained-and-served entirely on TPU is the existence proof. If the 1.2-1.7× perf at 53-77% power numbers hold at v7 scale, the TCO gap vs Nvidia widens.
- **For inference operators**: Ironwood's inference-first framing + 192 GB HBM/chip targets the exact use case that's bottlenecking GPU clouds today (large-context multimodal inference at scale).
- **For ML system designers**: AI Hypercomputer is a model for vertical integration. Even outside Google, the lesson is "tighter co-design wins" — Cerebras, Tenstorrent, Groq are all pushing toward similar stack integration. The pure-merchant-silicon strategy (just sell chips, let customers integrate) has a structural disadvantage on energy.

## Entities touched

[[Google]], [[TPU]], [[Ironwood]], [[Trillium]], [[XLA]], [[JAX]], [[Pathways]], [[Jupiter]], [[Gemini]], [[AI Hypercomputer]], [[A100]], [[Graphcore]], [[SparseCore]], [[OCS]], [[BF16]], [[NVIDIA]]

## Topics touched

[[AI Accelerators]], [[Accelerator Economics]], [[Vertical Integration]], [[LLM Training Systems]], [[LLM Inference Systems]]

## Raw source

[intuitionlabs.ai/pdfs/google-tpus-explained-...](https://intuitionlabs.ai/pdfs/google-tpus-explained-architecture-performance-for-gemini-3.pdf) — 16-page PDF · 614 KB · 14 figures (Marker-extracted). IntuitionLabs authored, Dec 19 2025 (rev Apr 17 2026). Read 2026-05-11 (Marker re-extraction).
