---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 4
tier: active
---

# MLA

Multi-Head Latent Attention; DeepSeek's KV-compression attention variant in DeepSeek-V2/V3; FlashMLA is its decode kernel.

## Synthesis


Multi-Head Latent Attention (MLA) was DeepSeek's KV-compression mechanism, load-bearing through V3/V3.2 (2024–2026), with two corpus lenses characterizing its inference behavior: at the systems level, prefill chunking in piggybacked co-located serving causes redundant down/up-projection per chunk, with the proposed mitigation being to cache up-projected KV from earlier chunks; at the kernel level, DeepSeek's choice not to tensor-parallel decode keeps h_q = 128, placing MLA squarely in compute-bound territory on H800 and forcing the FlashMLA seesaw schedule — which achieves ~80% Tensor Core utilization by vertically splitting the 64×512 output matrix across two alternating warpgroups. MLA was retired in DeepSeek V4 (released 2026-04-24), with its inventor replacing per-token KV compression with Compression Sparse Attention plus on-disk KV cache storage; the claimed economics are 27% of single-token inference FLOPs and 10% of KV cache relative to DeepSeek-V3.2 at 1M-token context (sourced from an xhs interpretation piece citing V4 §3.6.2 — treat specific numbers as receipts pending the V4 paper). Sebastian Raschka's LLM Architecture Gallery corroborates the retirement at the diagram level: V4-Pro and V4-Flash render with CSA + HCA composition rather than MLA, providing architecture-diagram-level confirmation independent of the xhs narrative. The bigger pattern: the field is shifting attention compression from "compress each token's KV" (MLA's axis) toward "compress which tokens participate at all" (sequence-dimension compression), which relativizes FlashMLA's per-token-KV decode kernel design point and opens the question of what the analogous CSA-decode kernel looks like.


**V4 retirement (2026-04-24).** MLA's inventor (DeepSeek) walked away from per-token KV compression in favor of **Compression Sparse Attention + on-disk KV cache storage**. V4-Pro / V4-Flash architectures render with CSA + HCA composition, not MLA. The claimed economics (panel-extracted, pending V4-paper-direct verification): V4-Pro at **27% of single-token inference FLOPs and 10% of KV cache compared with DeepSeek-V3.2** at 1M-token context. Bigger pattern: the field is shifting attention compression from "compress each token's KV" toward "compress which tokens participate at all" — sequence-dimension compression supplanting per-token compression. Implications: [[FlashMLA]]'s kernel design point (optimizing the per-token-KV decode pathway) is relativized; the analogous CSA-decode kernel doesn't yet have a published implementation in the corpus.

## Observations

- The disaggregation study identifies an MLA-specific overhead in piggybacked co-located serving: prefill chunking causes redundant down/up-projection of MLA per chunk. Mitigation: temporarily cache up-projected KV values from earlier chunks. The Pareto curves include both piggybacked and non-piggybacked configurations to capture this. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- The MLA-decoding kernel target for FlashMLA. Compute-bound regime on H800 (per-step ratio `≈ 2 h_q s_q`; crossover at `h_qs_q ≥ 128`); DeepSeek's choice not to TP decode keeps `h_q = 128`, putting MLA squarely in compute-bound territory. This shapes the entire kernel design: 660 TFlops via seesaw schedule, ~80% Tensor Core utilization. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **Retired in DeepSeek V4** per the V4 tech report (released 2026-04-24, image-receipts via an xhs interpretation piece). MLA's inventor walks away from per-token KV compression in favor of **Compression Sparse Attention** + on-disk KV cache storage; V4 returns to MHA + GQA primitives layered with sparse + sliding mechanisms. The claimed economics: **V4-Pro requires 27% of single-token inference FLOPs and 10% of KV cache compared with DeepSeek-V3.2** at 1M-token context (panel cites V4 §3.6.2). Treat the §-numbers as receipts to verify against V4's paper when it lands in the corpus; the directional claim (MLA-as-a-line-ends-here) is the load-bearing signal regardless of specific-number drift. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Architectural-diagram corroboration of V4's MLA retirement**: Sebastian Raschka's LLM Architecture Gallery renders V4-Pro and V4-Flash with CSA + HCA composition (not MLA), confirming the xhs narrative at the diagram level. Direct visual comparison against the MLA-era V3/R1 671B architecture is available in the same gallery. — [[2026-04-03-llm-architecture-gallery]]
