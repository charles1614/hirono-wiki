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

The two sources currently drawn on — [[2026-01-09-google-tpus-explained-architecture-perfo]] and [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — are both TPU-focused, so the synthesis below is weighted toward Google's stack. The GPU side is touched but not yet deeply sourced; that asymmetry should resolve as H100/Hopper and AMD/AWS sources accumulate.

**The load-bearing primitive is the systolic array.** Every TPU generation from v1 (2016, 256×256 array) through Ironwood (v7, 2025) is built on a large, regular matrix-multiply engine operating in a static, deterministic pipeline — no out-of-order execution, no deep general-purpose cache. That design trades instruction-level flexibility for two things: predictable 99th-percentile latency and near-peak MAC utilization on the dense linear-algebra operations that dominate AI workloads [[2026-01-09-google-tpus-explained-architecture-perfo]].

**Compute density and power efficiency have scaled together, not in tension.** Over seven TPU generations the per-chip FP8 throughput has grown ~30× in perf/watt since v2 (2017). The trajectory — roughly doubling efficiency every 1–2 years — reflects both lithography improvements and architecture refinements (bfloat16 introduced v2; INT8/INT4 v5e onward; native FP8 on Ironwood, where prior generations emulated it) [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. Power is now an explicit first-class constraint: Ironwood's 9,216-chip pod draws ~10 MW and requires liquid cooling; Google frames the perf/watt curve as its primary economic differentiation over merchant-silicon GPUs.

**The design pivot from training-first to inference-first is recent and deliberate.** Ironwood (v7, GA Nov 2025) is explicitly positioned as "the first Google TPU for the age of inference" — built for large-context, high-throughput serving rather than gradient updates. The three architectural moves that make that concrete: (1) 192 GB HBM per chip (6× Trillium), targeting long-context KV-cache capacity; (2) 7.37 TB/s HBM bandwidth (4.5× Trillium), eliminating memory-bandwidth as the serving bottleneck; (3) 1.2 TBps bidirectional ICI for fast intra-pod collective communication [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]. The philosophical claim — that AI is shifting from "responsive answers" to "proactive agents that retrieve and synthesize" — is Google's framing for why inference-optimized silicon is now the right design point.

**GPU microarchitecture has moved toward specialization by similar logic.** NVIDIA's Hopper generation (H100) introduced three features that have no direct analog in prior GPU generations: **Tensor Memory Accelerator (TMA)** for asynchronous block-level copies between HBM and shared memory; **Distributed Shared Memory (DSM)** for direct SM-to-SM communication without L2 traffic; and native **FP8 Tensor Cores** via the Transformer Engine. The practical ceiling on FP8 speedups is lower than peak rates suggest — Softmax and GeLU remain FP16, attention uses FlashAttention not FP8 Tensor Cores in current TE implementations — so the programmer-visible gains are workload-dependent [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]].

**The competitive field is broader than Google vs. NVIDIA.** Epoch.ai's hardware dataset (175 accelerators, updated May 2026) documents meaningful non-duopoly entrants: AMD Instinct MI350X/355X (~4.6 PFLOPS FP8, competitive with Ironwood per chip), AWS Trainium3 (~2.5 PFLOPS FP8), Huawei Ascend 920 (~900 TFLOPS BF16), Meta MTIA 300, Microsoft Maia 100, Intel Gaudi3, and Chinese domestic vendors (Cambricon, Moore Threads, Sunway). The announced-but-not-yet-sourced story is that FP8 support and high HBM capacity are converging across vendors as table-stakes, while differentiation is shifting to interconnect, software stack, and ecosystem lock-in.

**Vertical integration is the structural thesis.** Google's AI Hypercomputer — TPU silicon + Jupiter fabric + XLA/JAX/Pathways compiler stack, co-designed end-to-end — trained and serves Gemini 3 without GPUs. The reported efficiency comparison (TPU v4 pod: 1.2–1.7× throughput vs. equivalent A100 pod at 53–77% power) is the quantitative argument for vertical integration over merchant-silicon purchase [[2026-01-09-google-tpus-explained-architecture-perfo]]. The same thesis appears in Cerebras, Tenstorrent, and Groq's approaches — tighter chip-to-software co-design extracts efficiency gains that a horizontally-layered stack cannot.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
