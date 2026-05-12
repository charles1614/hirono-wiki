---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 5
tier: active
---

# MLA

Multi-Head Latent Attention; DeepSeek's KV-compression attention variant in DeepSeek-V2/V3; FlashMLA is its decode kernel.

## Synthesis

DeepSeek's KV-compression attention variant — characterized in the corpus across two distinct lenses: **(1) inference systems** (Beyond-the-Buzz NVIDIA paper) flags MLA-specific piggyback overhead — prefill chunking causes redundant down/up-projection per chunk; the proposed mitigation is to cache up-projected KV from earlier chunks; **(2) kernel-level** ([[FlashMLA]] deep-dive) shows MLA decoding is compute-bound on H800 because DeepSeek doesn't TP-decode, keeping `h_q = 128`. The seesaw kernel schedule is forced by the resulting 64×512 output matrix consuming half the SM register file.

## Observations

- The disaggregation study identifies an MLA-specific overhead in piggybacked co-located serving: prefill chunking causes redundant down/up-projection of MLA per chunk. Mitigation: temporarily cache up-projected KV values from earlier chunks. The Pareto curves include both piggybacked and non-piggybacked configurations to capture this. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- The MLA-decoding kernel target for FlashMLA. Compute-bound regime on H800 (per-step ratio `≈ 2 h_q s_q`; crossover at `h_qs_q ≥ 128`); DeepSeek's choice not to TP decode keeps `h_q = 128`, putting MLA squarely in compute-bound territory. This shapes the entire kernel design: 660 TFlops via seesaw schedule, ~80% Tensor Core utilization. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **Retired in DeepSeek V4** per the V4 tech report (released 2026-04-24, image-receipts via an xhs interpretation piece). MLA's inventor walks away from per-token KV compression in favor of **Compression Sparse Attention** + on-disk KV cache storage; V4 returns to MHA + GQA primitives layered with sparse + sliding mechanisms. The claimed economics: **V4-Pro requires 27% of single-token inference FLOPs and 10% of KV cache compared with DeepSeek-V3.2** at 1M-token context (panel cites V4 §3.6.2). Treat the §-numbers as receipts to verify against V4's paper when it lands in the corpus; the directional claim (MLA-as-a-line-ends-here) is the load-bearing signal regardless of specific-number drift. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Architectural-diagram corroboration of V4's MLA retirement**: Sebastian Raschka's LLM Architecture Gallery renders V4-Pro and V4-Flash with CSA + HCA composition (not MLA), confirming the xhs narrative at the diagram level. Direct visual comparison against the MLA-era V3/R1 671B architecture is available in the same gallery. — [[2026-04-03-llm-architecture-gallery]]
