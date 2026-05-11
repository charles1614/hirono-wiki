---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://intuitionlabs.ai/articles/google-tpus-architecture-performance-gemini-3
tags: [tpu, google, ironwood, gemini, hardware, ai-hardware-comparison, tpu-vs-gpu]
---

# [2026-01-09] Google TPUs Explained: Architecture & Performance for Gemini 3

## TL;DR

35-min industry analysis (IntuitionLabs, revised Apr 2026) — a comprehensive walkthrough of the [[TPU]] family from v1 (2017) to v7 (Ironwood, 2025), with absolute spec numbers + cross-generation comparisons + GPU contrasts. The thesis: **Google's TPU + custom interconnect (Jupiter optical switching) + co-designed software stack (XLA / JAX / Pathways) is now a credible end-to-end alternative to NVIDIA**, with Gemini 3 trained entirely on TPUs. Cross-references the [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] launch post but goes deeper on lineage, dataflow, and operating-cost comparisons.

## Key claims

- **TPU lineage in one sentence per generation:**
  - **v1 (2015 internal, 2017 public)**: 256×256 systolic array, 65,536 MACs, **92 TOPS peak**, 8-bit inference only.
  - **v2 (2017)**: training capability added; ~180 TFLOPS/board (BF16); 64-board pod.
  - **v3 (2018)**: 128 GB HBM/board; 32 TB-of-HBM pods; **>100 PFLOPS/pod**; MLPerf records (ResNet-50 in 16s).
  - **v4 (2020-21)**: **optical circuit switching (OCS)** in pod network; **4,096-chip pods** (~10× v3); 2.1× v3 perf.
  - **v5e + v5p (2023)**: split lines — v5e inference-optimized (393 TFLOPS INT8/chip), v5p training. **256-chip v5e pod = 100 PetaOps INT8**.
  - **v6e Trillium (late 2024)**: **4×+ Trillium over v5e** on per-chip throughput.
  - **v7 Ironwood (Nov 2025 GA)**: **~4,614 TFLOPS/chip**, 192 GB HBM, 9,216-chip pods (**42.5 EFLOPS/pod**); ~30× perf/watt vs first Cloud TPU (cross-ref [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]).
- **TPU v4 vs A100** (Jouppi et al. 2023, cited): **1.2–1.7× faster** on similarly-sized pods, **53–77% of the power**, **~3× less energy**, **~20× lower CO₂**. The energy/CO₂ ratios are the cleanest cost differentiator Google can claim.
- **TPU v4 vs Graphcore IPU Bow**: **4.3–4.5× faster** on similar chip counts.
- **Gemini 3 trained on TPUs only.** Industry analysis says Gemini 3 used v5e + v6e pods + JAX + Pathways + XLA — explicit shift from third-party GPUs. Symbolic + commercial.
- **The systolic-array bet.** TPU v1 had 256×256 = 65,536 8-bit MACs per cycle. Per generation, the array (or array-equivalent) and arithmetic precision have widened: v5e at INT8 hits 393 TOPS/chip; v7 ~4,614 TFLOPS/chip (precision shifted to lower, throughput compounded).
- **HBM-centric scaling.** v3: 128 GB/board; v4-v5: more HBM, very high BW (Ironwood at 7.4 TB/s, cited from [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]). MAC arrays must be fed; HBM expansion is the gating constraint as much as MAC count.
- **Optical circuit switching (TPU v4+).** Replaced electrical switches with optical OCS — enabled 10× larger pod scale (256-chip v3 pods → 4096-chip v4 pods). This is the *system-level* innovation often missed when comparing per-chip TFLOPS.
- **SparseCore in TPU v4+.** Dedicated accelerator for ultra-large embeddings (recsys, ranking). Speedup of **5–7×** for embedding-heavy workloads while consuming "only a fraction" of the chip area/power.
- **Vertical co-design.** XLA (compiler) + JAX/PyTorch-XLA (frameworks) + Pathways (distributed runtime) + Jupiter optical fabric (datacenter network) + AI Hypercomputer (top-level architecture). NVIDIA's CUDA story is the GPU-side equivalent; the post's argument is Google's *integration depth* is higher.
- **Customer evidence:** AssemblyAI claims 4× better throughput-per-dollar on v5e for speech; Gridspace claims 5× training speedup vs prior GPU stack. Marketing-curated; treat as upper bounds.
- **Gemini 3.1 Pro pricing** (current flagship): $2/$12 per Mtok (input/output).

### TPU spec progression (reproduced from §Table 1 + body text)

| Generation | Year | Mode | Per-chip / per-board | Pod scale | Key innovation |
|---|---|---|---|---|---|
| v1 | 2017 | Inference (INT8) | **92 TOPS** | (single-chip era) | 256×256 systolic array (65,536 MACs) |
| v2 | 2017 | Training (BF16) | **~180 TFLOPS / board** | 64-board pod | First TPU with training capability |
| v3 | 2018 | Training | **>100 PFLOPS / pod** | 32 TB HBM / pod | 128 GB HBM/board |
| v4 | 2020-21 | Training | 2.1× v3 perf | **4,096-chip pods** | Optical Circuit Switching, SparseCore |
| v5e | 2023 | Inference | **393 TOPS INT8** | 256-chip = 100 PetaOps | Inference-optimized split line |
| v5p | 2023 | Training | (higher than v5e) | — | Training-optimized split line |
| v6e Trillium | 2024 | Both | **4×+ v5e** | — | Generation-jump perf/watt |
| v7 Ironwood | Nov 2025 | Inference-first | **~4,614 TFLOPS/chip**, 192 GB HBM | **9,216 chips, 42.5 EFLOPS** | 7.4 TB/s HBM BW, 2× v6 perf/watt |

### TPU v4 vs alternatives (single-deployment level)

| Comparison | Throughput | Energy / CO₂ | Source |
|---|---|---|---|
| TPU v4 vs NVIDIA A100 (similar pod size) | 1.2–1.7× | ~3× less energy, ~20× less CO₂; uses 53–77% of A100 power | Jouppi et al. 2023 |
| TPU v4 vs Graphcore IPU Bow | 4.3–4.5× | — | Jouppi et al. 2023 |
| TPU v1 vs CPU/GPU (2017) | 15–30× faster on inference | — | Jouppi et al. 2017 |
| AssemblyAI on TPU v5e | 4× throughput/$ for speech | — | Customer testimonial |
| Gridspace on TPU | 5× training speedup | — | Customer testimonial |

## Visual observations

- *(PDF preserved at `<slug>.pdf` + per-page renderings; 16 pages. The article is text-heavy with embedded TPU lineage charts and dataflow diagrams; key facts are extractable from text alone. Image-reading deferred unless someone wants the systolic-array diagram or the Jupiter optical-network topology view.)*

## Entities touched

[[Google]], [[TPU]], [[Ironwood]], [[Trillium]], [[Pathways]], [[XLA]], [[JAX]], [[Gemini]], [[NVIDIA]], [[A100]], [[Graphcore]], [[SparseCore]], [[TensorFlow]]

## Topics touched

[[Inference-Optimized Accelerators]], [[Training Infrastructure]], [[Accelerator Economics]], [[Low-Precision Training]]

## Open questions

- The "TPU v4 uses 53–77% of A100 power" comparison is from 2023 — Hopper (H100) has since narrowed that gap on FP8 perf/watt. What does the comparison look like with Blackwell (B200) vs Ironwood? Both vendors claim 2× their respective predecessors per-watt; both can't be growing the lead.
- TPU v5p hard numbers (FLOPS, HBM) are oddly missing from this article — only v5e gets full spec. Is v5p's spec a competitive secret, or is it because v5p was internal-Google-only until later?
- **OpenCloudSwitching (OCS) for inference workloads** — was it designed for training (batch-friendly) but does it hurt inference latency? Inference traffic patterns are bursty; circuit-switched fabric works best for stable predictable flows.
- The 5×–7× SparseCore speedup is on recsys / embeddings — Ironwood's [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] expands this to "finance + scientific workloads." Concrete customer cases? Otherwise speculation.
- **Cost-per-FLOP claim is vague** ("internal analysis shows lower cost than GPU clusters"). No published $-figures. Compare against the more-public Trainium3-vs-H100 numbers from AWS — the AI hardware economics space is finally getting numeric.
- Article hits 16 pages but is written for industry analysts, not deep practitioners. Practitioners would want: TPU SDK comparison vs CUDA (writing kernels in Pallas vs CUDA); compile-time profile of XLA vs torch.compile; cost of moving an existing PyTorch repo to PyTorch/XLA. None of those are covered.

## Raw source

[intuitionlabs.ai/articles/google-tpus-architecture-performance-gemini-3](https://intuitionlabs.ai/articles/google-tpus-architecture-performance-gemini-3) — 16-page PDF report, 629 KB. PDF preserved at `raw/raindrop/intuitionlabs.ai/2026-01-09-google-tpus-explained-architecture-perfo/2026-01-09-google-tpus-explained-architecture-perfo.pdf`.
