---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 4
tier: active
---

# MLA

Multi-Head Latent Attention; DeepSeek's KV-compression attention variant in DeepSeek-V2/V3; FlashMLA is its decode kernel.

## Synthesis

DeepSeek's KV-compression attention variant — characterized in the corpus across two distinct lenses: **(1) inference systems** (Beyond-the-Buzz NVIDIA paper) flags MLA-specific piggyback overhead — prefill chunking causes redundant down/up-projection per chunk; the proposed mitigation is to cache up-projected KV from earlier chunks; **(2) kernel-level** ([[FlashMLA]] deep-dive) shows MLA decoding is compute-bound on H800 because DeepSeek doesn't TP-decode, keeping `h_q = 128`. The seesaw kernel schedule is forced by the resulting 64×512 output matrix consuming half the SM register file.

## Observations

- The disaggregation study identifies an MLA-specific overhead in piggybacked co-located serving: prefill chunking causes redundant down/up-projection of MLA per chunk. Mitigation: temporarily cache up-projected KV values from earlier chunks. The Pareto curves include both piggybacked and non-piggybacked configurations to capture this. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- The MLA-decoding kernel target for FlashMLA. Compute-bound regime on H800 (per-step ratio `≈ 2 h_q s_q`; crossover at `h_qs_q ≥ 128`); DeepSeek's choice not to TP decode keeps `h_q = 128`, putting MLA squarely in compute-bound territory. This shapes the entire kernel design: 660 TFlops via seesaw schedule, ~80% Tensor Core utilization. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **Reported retired in DeepSeek V4** per an xhs interpretation piece. Luo Fuli's early-April 2026 interview asserted "MLA has no space left to develop"; V4's tech report (per the post) drops MLA and adopts hybrid attention with CSA + HCA, compressing a claimed 1M-token KV cache to ~5 GB. Treat as signal not citation — verify against V4's tech report when ingested. The structural argument is sharper than the prediction-tracking narrative: the field is shifting from "compress each token's KV" to "compress which tokens participate." — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
