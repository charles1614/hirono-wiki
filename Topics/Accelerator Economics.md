---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 4
---

# Accelerator Economics

## What

Performance, power, and dollar-cost tradeoffs across AI accelerator vendors and generations — the axis along which TPU vs GPU vs custom-silicon strategies actually compete. Not just FLOPs: total cost of ownership including silicon, networking, power, and the operational efficiency of the integrated stack. At hyperscale, power is increasingly the binding constraint rather than silicon-area, which reshapes the comparison.

## Current understanding

**The dominant framing through 2025-2026 has shifted from raw FLOPs to perf-per-watt as the primary competitive axis.** Both Google and NVIDIA are explicitly positioning next-gen silicon on energy efficiency, but they are making structurally different arguments. Google's pitch is vertical integration as the efficiency lever; NVIDIA's is precision-format throughput multipliers as the dollar-per-token lever.

**Google's TPU trajectory** ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]], [[2026-01-09-google-tpus-explained-architecture-perfo]]) is the clearest case study in compounding perf/W gains from co-design. Ironwood (v7, GA Nov 2025) delivers **4,614 TFLOPS FP8 per chip, 192 GB HBM, and 2× perf/W over Trillium** — with Google claiming ~30× the perf/W of the original Cloud TPU v2. The 9,216-chip pod reaches 42.5 Exaflops, sized for the exact large-context inference workloads (Gemini 3, 1M+ token context) that are currently bottlenecking GPU clouds. The **Gemini 3 trained-and-served entirely on TPU** data point is the existence proof for TPU competitive parity at frontier scale — not a lab claim but a production deployment. The pre-Ironwood efficiency numbers are also concrete: TPU v4 pods delivered **1.2-1.7× higher throughput than equivalent A100 pods at 53-77% of the power**, with roughly 3× less datacenter electricity and 20× lower CO₂ than on-prem GPU servers for equivalent training ([[2026-01-09-google-tpus-explained-architecture-perfo]]).

**The vertical-integration thesis** is the structural argument Google is making. The **AI Hypercomputer** stack — TPU silicon + Jupiter packet-routed fabric (100K chips at 13 Pbps for Trillium-generation) + Pathways distributed runtime + XLA/JAX compiler — is co-designed end-to-end. The claim is that merchant-silicon strategies have a structural energy disadvantage because chip, interconnect, and software are separately optimized rather than jointly. Ironwood's native FP8 support (vs emulated FP8 on v4/v5p) and the SparseCore accelerator for embedding-heavy workloads are examples of where co-design surfaces efficiency that chip-only purchasing cannot replicate.

**NVIDIA's counter is not a direct perf/W match — it is a throughput-per-dollar reframing via precision.** The NVFP4 pretraining result (12B/10T training run, FP4 quality matches FP8) is the technical foundation for "Blackwell doubles effective throughput on the same hardware." The concrete deployment numbers from [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] ground this in dollar-relevant terms: **420 tps/user at low-latency on 8× B200, >20k tps/gpu max-throughput on GB200, >1.5M tps system-wide on a single GB200 NVL72**. These are the denominators for accelerator-class economics comparisons — the GB200 NVL72 inference headline for a 120B frontier MoE model at production scale. NVIDIA's implicit vertical-integration play is **CUDA/TensorRT/Megatron as software lock-in** — the ecosystem is itself a form of integration, even if the chips are sold merchant-style.

**Where the sources agree**: power is now the binding constraint, not silicon area alone. Both Google and NVIDIA frame their next-gen product positioning around energy efficiency rather than peak FLOP counts in isolation. The shift is visible in how both companies present TCO: Google as perf/W trajectories across TPU generations, NVIDIA as effective tps/$  enabled by FP4 throughput gains.

**Where uncertainty remains**: the published TPU v4-vs-A100 comparisons predate H100 and B200. Whether the 1.2-1.7× throughput advantage at 53-77% power holds against Blackwell is an open question — NVIDIA's per-chip gains from Hopper to Blackwell are substantial, and the NVFP4 throughput doubling, if it holds at 70B+ scale, would materially narrow any remaining perf/W gap. The load-bearing test is the Gemini 3 existence proof: Google committed entirely to TPU for a frontier model, which is a stronger signal than efficiency benchmarks on isolated workloads. Whether that generalizes to labs without Google's Pathways/JAX investment remains unresolved.

## Open threads

- TPU v4 vs A100 perf-at-power numbers (1.2-1.7× at 53-77% power) date from 2023. Does the gap hold against H100 / B200? H100 is significantly faster than A100 per chip. — [[2026-01-09-google-tpus-explained-architecture-perfo]]
- Power as competitive moat: does Ironwood + AI Hypercomputer become a structural advantage vs Nvidia, or does Nvidia + grid-power-PPA close the gap? — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]

## Sources drawn on

- [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] — concrete Blackwell deployment numbers (1.5M tps on GB200 NVL72); the dollar-per-token denominators for any TCO comparison.
- [[2026-01-09-google-tpus-explained-architecture-perfo]] — IntuitionLabs cross-gen analysis with the 1.2-1.7× perf at 53-77% power claim and the Gemini-3-on-TPU existence-proof framing.
- [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — Google's primary-source Ironwood announcement; the 30× perf/W vs v2 + 2× vs Trillium positioning is canonical here.

