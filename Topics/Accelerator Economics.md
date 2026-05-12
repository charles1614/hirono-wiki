---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 3
---

# Accelerator Economics

## What

Performance, power, and dollar-cost tradeoffs across AI accelerator vendors and generations — the axis along which TPU vs GPU vs custom-silicon strategies actually compete. Not just FLOPs: total cost of ownership including silicon, networking, power, and the operational efficiency of the integrated stack. At hyperscale, power is increasingly the binding constraint rather than silicon-area, which reshapes the comparison.

## Current understanding

**The 2025-2026 framing has shifted from perf to perf-per-watt.** Both Google and NVIDIA are explicitly positioning their next-gen silicon on energy efficiency:

- **Google's pitch** (per [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]): Ironwood claims **~30× the perf/W of TPU v2** and **2× over Trillium**. The narrative is "available power is one of the constraints for delivering AI capabilities" — vertical integration (TPU silicon + Jupiter fabric + Pathways + XLA/JAX) as the structural advantage. The third-party IntuitionLabs analysis ([[2026-01-09-google-tpus-explained-architecture-perfo]]) cites the 2023 Jouppi figure that **TPU v4 pods deliver 1.2-1.7× higher throughput than equivalent A100 pods at 53-77% of the power**, with ~3× less electricity and ~20× lower CO₂ than on-prem GPU servers for equivalent training. Open question: do those numbers hold against H100/B200, where NVIDIA's per-chip gains are substantial?

- **NVIDIA's counter** isn't matching TPU efficiency directly — it's **reframing "perf per dollar" as "effective throughput per dollar" via narrower precision**. NVFP4 pretraining (12B/10T, matches FP8 quality) is the technical backbone of "Blackwell's FP4 silicon investment doubles effective throughput on the same hardware." Combined with concrete deployment recipes that surface dollar-relevant numbers (see [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]: **420 tps/user low-latency on 8× B200, >20k tps/gpu max-throughput on GB200, >1.5M tps system-wide on a single GB200 NVL72**), these become the dollar-per-token denominators when evaluating accelerator-class economics.

- **The vertical-integration thesis** (TPU + Jupiter + Pathways + JAX + XLA, all co-designed) vs the **merchant-silicon thesis** (NVIDIA sells chips; customers integrate). Google's argument is that the merchant strategy has a structural energy disadvantage that compounds at hyperscale. NVIDIA's counterargument is implicit in CUDA/TensorRT/Megatron: the software lock-in is itself a form of vertical integration, and FP4 silicon collapses the perf-per-watt gap.

The Gemini-3-entirely-on-TPU existence proof is currently the strongest single data point for TPU's competitive position. Whether that generalizes to other frontier labs depends on (a) the NVFP4 throughput-doubling holding at 70B+ scale and (b) operator willingness to commit to TPU's compiler/runtime stack vs the CUDA ecosystem.


## Open threads

- TPU v4 vs A100 perf-at-power numbers (1.2-1.7× at 53-77% power) date from 2023. Does the gap hold against H100 / B200? H100 is significantly faster than A100 per chip. — [[2026-01-09-google-tpus-explained-architecture-perfo]]
- Power as competitive moat: does Ironwood + AI Hypercomputer become a structural advantage vs Nvidia, or does Nvidia + grid-power-PPA close the gap? — [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]]

## Sources drawn on

- [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] — concrete Blackwell deployment numbers (1.5M tps on GB200 NVL72); the dollar-per-token denominators for any TCO comparison.
- [[2026-01-09-google-tpus-explained-architecture-perfo]] — IntuitionLabs cross-gen analysis with the 1.2-1.7× perf at 53-77% power claim and the Gemini-3-on-TPU existence-proof framing.
- [[2026-01-12-ironwood-the-first-google-tpu-for-the-ag]] — Google's primary-source Ironwood announcement; the 30× perf/W vs v2 + 2× vs Trillium positioning is canonical here.

