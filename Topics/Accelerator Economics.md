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

**Google's TPU trajectory** ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]], [[2026-01-09-google-tpus-explained-architecture-perfo]]) is the clearest case study in compounding perf/W gains from co-design. Ironwood (v7, GA Nov 2025) delivers **4,614 TFLOPS FP8 per chip, 192 GB HBM, and 2× perf/W over Trillium** — with Google claiming ~30× the perf/W of the original Cloud TPU v2. The 9,216-chip pod reaches 42.5 Exaflops, sized for the exact large-context inference workloads (Gemini 3, 1M+ token context) that are currently bottlenecking GPU clouds. The **Gemini 3 trained-and-served entirely on TPU** data point is the existence proof for TPU competitive parity at frontier scale — not a lab claim but a production deployment. Pre-Ironwood efficiency numbers are also concrete: TPU v4 pods delivered **1.2-1.7× higher throughput than equivalent A100 pods at 53-77% of the power**, with roughly 3× less datacenter electricity and 20× lower CO₂ than on-prem GPU servers for equivalent training ([[2026-01-09-google-tpus-explained-architecture-perfo]]).

**The vertical-integration thesis** is the structural argument Google is making. The **AI Hypercomputer** stack — TPU silicon + Jupiter packet-routed fabric (100K chips at 13 Pbps for Trillium-generation) + Pathways distributed runtime + XLA/JAX compiler — is co-designed end-to-end. The claim is that merchant-silicon strategies have a structural energy disadvantage because chip, interconnect, and software are separately optimized rather than jointly. Ironwood's native FP8 support (vs emulated FP8 on v4/v5p) and the SparseCore accelerator for embedding-heavy workloads are examples of where co-design surfaces efficiency that chip-only purchasing cannot replicate ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]).

**NVIDIA's counter is not a direct perf/W match — it is a throughput-per-dollar reframing via precision.** The NVFP4 pretraining result (12B/10T training run, FP4 quality matches FP8) is the technical foundation for "Blackwell doubles effective throughput on the same hardware." The concrete deployment numbers from [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] ground this in dollar-relevant terms: **420 tps/user at low-latency on 8× B200, >20k tps/gpu max-throughput on GB200, >1.5M tps system-wide on a single GB200 NVL72** (gpt-oss-120b, ISL=1k OSL=2k). These are the denominators for accelerator-class economics comparisons at production scale. NVIDIA's implicit vertical-integration play is **CUDA/TensorRT/Megatron as software lock-in** — the ecosystem is itself a form of integration, even if the chips are sold merchant-style.

**The generation-table picture from TPU v1 to v7** ([[2026-01-09-google-tpus-explained-architecture-perfo]]) is instructive for understanding the compounding dynamic. TPU v5e delivered 2.5× perf/$ vs v4 on inference, with 1.7× lower latency. TPU v6e (Trillium) brought ~4× perf and +67% efficiency vs v5 in training. Ironwood (v7) layers on another 2× perf/W over Trillium. Against the v2 baseline, Google claims ~30× cumulative power efficiency. Whether this trajectory outpaces NVIDIA's own per-generation gains (H100 → Blackwell) is an open question the current sources cannot answer, since head-to-head Ironwood vs Blackwell benchmarks are not yet in the cited corpus.

**Where the sources agree**: power is now the binding constraint, not silicon area alone. Both Google and NVIDIA frame their next-gen positioning around energy efficiency rather than peak FLOP counts in isolation. The shift is visible in how both companies present TCO: Google as perf/W trajectories across TPU generations, NVIDIA as effective tps/$ enabled by FP4 throughput gains.

**Where uncertainty remains**: the published TPU v4-vs-A100 comparisons predate H100 and B200. Whether the 1.2-1.7× throughput advantage at 53-77% power holds against Blackwell is an open question — NVIDIA's per-chip gains from Hopper to Blackwell are substantial, and the NVFP4 throughput doubling, if it holds at 70B+ scale, would materially narrow any remaining perf/W gap. The load-bearing signal is the Gemini 3 existence proof: Google committed entirely to TPU for a frontier model, which is a stronger signal than efficiency benchmarks on isolated workloads. Whether that generalizes to labs without Google's Pathways/JAX investment remains unresolved.

## Comparison

Axis × option table comparing TPU v7 Ironwood (Google's current-gen inference-first platform) against NVIDIA GB200 / NVL72 (Blackwell-generation merchant GPU). Figures cited from Sources only; `?` where no cited Source provides the value; `N/A` where the axis is definitionally inapplicable.

| Axis | TPU v7 Ironwood | NVIDIA GB200 / NVL72 |
|---|---|---|
| **Peak compute per chip (FP8)** | 4,614 TFLOPS ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | ? (cited sources give tps not raw TFLOPS) |
| **Memory per chip** | 192 GB HBM (6× Trillium) ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | ? |
| **HBM bandwidth per chip** | 7.37 TB/s (4.5× Trillium) ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | ? |
| **Max scale-up pod / system size** | 9,216 chips → 42.5 EFLOPS/pod ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | 72 GPUs / NVL72 rack ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **Scale-up interconnect** | ICI 3D torus; 1.2 TBps bidirectional/chip (1.5× Trillium); Optical Circuit Switches for cross-pod ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | NVLink (rack-scale NVL72) ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **Max-throughput inference (120B MoE)** | ? (no cited head-to-head number) | >1.5M tps system-wide on GB200 NVL72 ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **Low-latency inference (120B MoE, batch 1)** | ? | 420 tps/user on 8× B200 ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **tps/gpu max-throughput** | ? | >20k tps/gpu on GB200 (DP4EP4 config) ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **Perf/W vs prior gen** | 2× over Trillium (v6); ~30× over Cloud TPU v2 ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | ? (no cited normalized perf/W trajectory) |
| **v4 vs A100 throughput at power** | 1.2-1.7× throughput at 53-77% of A100 pod power; ~3× less datacenter electricity for equivalent training ([[2026-01-09-google-tpus-explained-architecture-perfo]]) | N/A (A100 is the reference baseline in this comparison) |
| **FP8 precision** | Native on Ironwood; emulated on v4/v5p ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | Native (H100+); Hopper supports FP8 transformer engine |
| **FP4 / sub-FP8 precision** | ? | NVFP4 on Blackwell; 12B/10T pretraining run where FP4 matches FP8 quality ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] context) |
| **Software ecosystem** | XLA/JAX/Pathways (Google-internal depth; PyTorch/XLA maturing); not CUDA-compatible ([[2026-01-09-google-tpus-explained-architecture-perfo]]) | CUDA/TensorRT/Megatron; broad open-source library coverage ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **SparseCore / embedding acceleration** | SparseCore: ~5% of die, 5-7× embedding speedup; extended to financial/scientific workloads on Ironwood ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]], [[2026-01-09-google-tpus-explained-architecture-perfo]]) | N/A (no equivalent cited) |
| **Cooling requirement** | Liquid-cooled mandatory at 10 MW pod scale; flow-rate-controlled coolant ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | ? |
| **Frontier-model existence proof** | Gemini 3 trained and served entirely on TPU ([[2026-01-09-google-tpus-explained-architecture-perfo]]) | gpt-oss-120b (120B frontier MoE) deployed on GB200 NVL72 ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) |
| **Availability model** | GCP cloud rental + direct hardware sales to external customers (post-2025 merchant mode) ([[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]) | Merchant GPU sold via OEM + cloud providers |

## Open threads

- TPU v4 vs A100 perf-at-power numbers (1.2-1.7× at 53-77% power) date from 2023. Does the gap hold against H100 / B200? H100 is significantly faster than A100 per chip. — [[2026-01-09-google-tpus-explained-architecture-perfo]]
- Power as competitive moat: does Ironwood + AI Hypercomputer become a structural advantage vs Nvidia, or does Nvidia + grid-power-PPA close the gap? — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]

## Sources drawn on

- [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] — concrete Blackwell deployment numbers (1.5M tps on GB200 NVL72); the dollar-per-token denominators for any TCO comparison.
- [[2026-01-09-google-tpus-explained-architecture-perfo]] — IntuitionLabs cross-gen analysis with the 1.2-1.7× perf at 53-77% power claim and the Gemini-3-on-TPU existence-proof framing.
- [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — Google's primary-source Ironwood announcement; the 30× perf/W vs v2 + 2× vs Trillium positioning is canonical here.

