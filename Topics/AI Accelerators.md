---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 3
---

# AI Accelerators

## What

Specialized hardware optimized for AI workloads (TPUs, GPUs, custom ASICs) — design choices that differentiate from general-purpose compute.

## Current understanding

The primary design divide in AI accelerators is between **systolic-array ASICs** (Google TPU lineage) and **GPU microarchitectures** (NVIDIA Hopper/Ampere). Both converge on the same workload reality — dense matrix multiply, collective communication, and increasingly large memory footprints — but reach it via different tradeoffs. TPUs trade general-purpose flexibility for a static, deterministic pipeline with no out-of-order execution and no deep general-purpose cache; the payoff is predictable 99th-percentile latency and near-peak MAC utilization on the linear-algebra operations that dominate training and inference [[2026-01-09-google-tpus-explained-architecture-perfo]]. GPUs retain a more programmable substrate and add specialization incrementally — each Hopper-generation feature (TMA, DSM, FP8 Tensor Cores) is a targeted micro-architectural addition rather than a full-stack redesign [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]].

**Precision support has become table-stakes across vendors.** The Tensor Core precision ladder — FP16/FP32 (Volta), +BF16/TF32/INT8 (Ampere), +FP8 (Hopper) — mirrors the TPU precision progression: BF16 introduced at v2, INT8/INT4 at v5e, native FP8 at Ironwood (v7). The distinction matters: Ironwood's FP8 is native; earlier TPU generations (v4, v5p) emulated it, paying an emulation tax [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. On the GPU side, Hopper's Transformer Engine exposes FP8 through te.Linear, but Softmax and GeLU remain FP16, and DotProductAttention uses FlashAttention rather than FP8 Tensor Cores — so the practical speedup is workload-dependent and consistently below peak-rate arithmetic [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]].

**Memory is the dominant bottleneck for large-context inference, and both camps are racing to close it.** Ironwood carries 192 GB HBM per chip (6× its predecessor Trillium) at 7.37 TB/s bandwidth (4.5× Trillium) — an explicit architectural decision to target long-context KV-cache capacity and eliminate bandwidth as the serving bottleneck [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. The design pivot is deliberate: Google frames Ironwood as "the first TPU for the age of inference," built for proactive agents that retrieve and synthesize rather than real-time response. The same architectural logic motivates H100's **Distributed Shared Memory (DSM)** — direct SM-to-SM communication reduces L2/HBM traffic for cooperating SMs during collective operations — and **TMA** for asynchronous data movement that overlaps compute with memory transfers [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]].

**Interconnect and pod-scale fabric are where the differentiation compounds.** TPU v4 introduced Optical Circuit Switches for dynamic 5-D torus fabric reconfiguration (< 5% of pod cost, < 3% of pod power), enabling 4,096-chip pods. Trillium (v6e) stepped to 100K-chip pods on a 13 Pbps Jupiter fabric. Ironwood carries 1.2 TBps bidirectional ICI (1.5× Trillium), and the Pathways runtime composes hundreds of thousands of chips across multiple Ironwood pods [[2026-01-09-google-tpus-explained-architecture-perfo]] [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. The NVIDIA side of this comparison is not yet deeply sourced here — the Hopper benchmark paper focuses on per-chip micro-architecture, not pod-scale interconnect.

**Power efficiency is now the primary economic framing.** TPU v4 pods deliver 1.2–1.7× the throughput of equivalent A100 pods at 53–77% of the power; Ironwood claims 2× perf/watt over Trillium and ~30× over TPU v2 [[2026-01-09-google-tpus-explained-architecture-perfo]] [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. Google explicitly positions the perf/watt curve as its primary economic differentiation: available power is a hard constraint on datacenter capacity, and at Ironwood's 9,216-chip pod scale (~10 MW, liquid-cooled), every efficiency gain translates directly to cost and operational headroom.

**Vertical integration is the structural thesis, not a product feature.** Google's AI Hypercomputer — TPU silicon + Jupiter fabric + XLA/JAX/Pathways compiler stack, co-designed end-to-end — trained and serves Gemini 3 without GPUs. The efficiency comparison (TPU v4 vs A100 pod) is evidence for the thesis that tighter chip-to-software co-design extracts gains unavailable to a horizontally-layered stack [[2026-01-09-google-tpus-explained-architecture-perfo]]. The same logic appears in Cerebras, Tenstorrent, and Groq's architectures. The competitive field is broader than the two primary sources reflect — AMD Instinct, AWS Trainium, Huawei Ascend, Meta MTIA, and domestic Chinese vendors all exist in Epoch.ai's dataset — but those specs are not yet sourced and are marked `?` in the table below.

**The sourcing asymmetry is real and acknowledged.** Both deeply-sourced papers are Google/TPU-focused; the H100 paper is a micro-architecture benchmark study, not a system-level comparison. The GPU-side pod-scale numbers, AMD/AWS/Huawei competitive specs, and cross-vendor software-stack assessments will require additional Sources before the synthesis can be treated as balanced.

## Comparison

| Axis | Google TPU Ironwood (v7) | Google TPU Trillium (v6e) | NVIDIA H100 (Hopper) |
|---|---|---|---|
| **Peak compute (FP8 per chip)** | ~4,614 TFLOPS FP8 [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | ~4.7× v5 peak (exact TFLOPS not cited) [[2026-01-09-google-tpus-explained-architecture-perfo]] | ? (headline FP8 TFLOPS not cited in sourced paper) |
| **HBM per chip** | 192 GB [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | ~2× v5 HBM (exact GB not cited) [[2026-01-09-google-tpus-explained-architecture-perfo]] | ? (not cited in sourced paper) |
| **HBM bandwidth per chip** | 7.37 TB/s [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | ? (not cited in sourced paper) | ? (not cited in sourced paper) |
| **Native FP8 support** | Yes — native [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | No — emulated [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | Yes — FP8 Tensor Cores via Transformer Engine; Softmax/GeLU remain FP16; attention uses FlashAttention, not FP8 TC [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |
| **Max pod scale** | 9,216 chips → ~42.5 EFLOPS/pod [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | 100K chips/pod @ 13 Pbps Jupiter fabric [[2026-01-09-google-tpus-explained-architecture-perfo]] | ? (not cited in sourced paper) |
| **Intra-pod interconnect** | 1.2 TBps bidirectional ICI (1.5× Trillium) [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | 13 Pbps bisectional Jupiter (100K-chip pod) [[2026-01-09-google-tpus-explained-architecture-perfo]] | DSM: direct SM-to-SM communication reduces L2/HBM traffic; bandwidth not cited [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |
| **Async data movement** | On-chip Unified Buffer + weight FIFO feeds systolic array [[2026-01-09-google-tpus-explained-architecture-perfo]] | Same [[2026-01-09-google-tpus-explained-architecture-perfo]] | TMA: asynchronous block-level copies between HBM and shared memory, overlaps compute with data movement [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |
| **Perf/watt vs prior gen** | 2× over Trillium; ~30× over TPU v2 [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | +67% efficiency vs v5 [[2026-01-09-google-tpus-explained-architecture-perfo]] | ? (Hopper paper benchmarks latency/throughput, not perf/watt) |
| **vs A100 pod (throughput / power)** | ? (not directly compared to A100 in sourced material) | TPU v4: 1.2–1.7× throughput at 53–77% power vs A100 pod [[2026-01-09-google-tpus-explained-architecture-perfo]] | N/A (H100 is A100's successor; comparison is TPU v4 vs A100) |
| **Primary design target** | Inference-first: large-context serving, KV-cache capacity [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | Both training + inference (trained Gemini 2.0) [[2026-01-09-google-tpus-explained-architecture-perfo]] | General GPU with LLM specialization via Transformer Engine [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |
| **Compute architecture** | Large systolic array, static/deterministic pipeline, no out-of-order execution [[2026-01-09-google-tpus-explained-architecture-perfo]] | Same [[2026-01-09-google-tpus-explained-architecture-perfo]] | Streaming multiprocessor array; programmable; Tensor Cores for matrix ops [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |
| **Special-purpose units** | SparseCore — embeddings + financial/scientific workloads [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | SparseCore [[2026-01-09-google-tpus-explained-architecture-perfo]] | DPX instructions — hardware-accelerated dynamic programming (HW-native on Hopper; emulated on older CUDA) [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |
| **Cooling requirement** | Liquid cooling mandatory at 9,216-chip pod (~10 MW) [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | ? (not cited in sourced paper) | ? (not cited in sourced paper) |
| **Software stack** | XLA / JAX / Pathways (co-designed; Pathways composes hundreds of thousands of chips cross-pod) [[2026-01-09-google-tpus-explained-architecture-perfo]] [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] | Same [[2026-01-09-google-tpus-explained-architecture-perfo]] | CUDA / cuDNN / Transformer Engine; te.Linear is only fully FP8-quantized operator path [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] |

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
