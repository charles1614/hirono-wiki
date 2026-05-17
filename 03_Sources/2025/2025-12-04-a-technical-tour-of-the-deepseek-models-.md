---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://magazine.sebastianraschka.com/p/technical-deepseek
tags: [pretraining, post-training, moe, attention-kernels, announcement]
---

# [2025-12-04] A Technical Tour of the DeepSeek Models from V3 to V3.2

## TL;DR

Sebastian Raschka's deep-dive (Substack, Dec 2025, last updated Jan 1 2026) tracing DeepSeek V3 → R1 → V3.1 → V3.2-Exp → V3.2 as a lineage of architectural and training-recipe choices. Three load-bearing findings: **(1) V3.2 adds DeepSeek Sparse Attention (DSA) on top of MLA** — a learned lightning-indexer + token-selector that cuts attention from O(L²) to O(Lk); **(2) V3.2 imports self-verification + self-refinement from DeepSeekMath V2** (generator trained under a separately-developed proof verifier, then collapsed to a single model at inference); **(3) GRPO is updated** with domain-specific KL weights, unbiased KL estimation, off-policy sequence masking, and MoE routing-replay — closer to original GRPO than DAPO/Dr. GRPO but with logical fixes.

## Key claims

- **Release lineage**: V3 (Dec 2024, base) → R1 (Jan 2025, RLVR reasoning) → R1-0528 (minor upgrade, ~OpenAI o3 parity) → V3.1 (hybrid reasoning, same V3 architecture) → V3.2-Exp (Sep 2025, adds DSA) → V3.2 (Dec 1, 2025, adds self-verification + GRPO updates).
- **DeepSeek Sparse Attention (DSA)**: added in V3.2-Exp and kept in V3.2. Computes a lightning-indexer similarity score `I_{t,s} = Σ_j w_{t,j} · ReLU(q_{t,j} · k_s)` using MLA's compressed representations; a token selector retains top-k=2048 past tokens per query; reduces attention complexity from O(L²) to O(Lk). Goal: reduce performance degradation from sparsity while gaining efficiency, especially in long-context.
- **MoE + MLA unchanged**: V3.2 uses the same 671B MoE architecture (256 experts, 9 active) and MLA from V2/V3. DSA is additive, not a replacement for MLA.
- **Hybrid reasoning**: V3.1 and V3.2 are hybrid instruct/reasoning models (mode-switching via prompt template), unlike R1 which was a dedicated reasoning model. Raschka speculates a dedicated R2 is still under development.
- **DeepSeekMath V2 self-verification**: trains a separate proof verifier (LLM 2) and meta-verifier (LLM 3) to score the proof generator (LLM 1) with rubric 0/0.5/1. Meta-verifier improved verifier quality score from 0.85 → 0.96. At inference, only the single trained generator runs (separate verifier dropped); the generator has internalized the verifier's rubric.
- **Self-refinement**: up to 8 iterations of generate → verify → refine; accuracy improvements don't saturate at 8 iterations. At inference the same model handles both generation and verification (2-in-1 after training).
- **GRPO modifications**: (a) domain-specific KL strength (very weak or zero for math); (b) unbiased KL estimate via importance-ratio reweighting; (c) off-policy sequence masking (drop stale rollouts with negative advantage); (d) MoE routing replay (force same expert routing during gradient update as during rollout); (e) top-k sampling mask replay. Keeps original GRPO advantage normalization rather than switching to DAPO/Dr. GRPO alternatives.
- **RLVR hybrid reward**: for verifiable domains (math, code) uses rule-based verifier; for general tasks uses a generative reward model (LLM-as-a-judge); length penalty added for agentic tasks; format reward removed.
- **V3.2-Speciale**: extended-thinking variant trained only on reasoning data + reduced length penalty, analogous to R1 within the V3.2 family.
- **mHC (Manifold-Constrained Hyper-Connections)**: separate Dec 31, 2025 research from DeepSeek — generalizes residual connections into learned multi-stream mixing constrained to a norm-preserving manifold; improves training stability with modest overhead.
- **Hardware**: Raschka notes DeepSeek returned to NVIDIA chips for V3.2 training after experimentation with Huawei chips.

## Visual observations

*No load-bearing images — all panels are architecture-flow diagrams, benchmark-table screenshots, and training-pipeline schematics whose content is fully captured in the body text above.*

## Entities touched

[[DeepSeek]], [[DeepSeek-R1]], [[MLA]], [[MoE]], [[Sebastian Raschka]]

## Topics touched

[[LLM Architectures]]

## Raw source

[magazine.sebastianraschka.com/p/technical-deepseek](https://magazine.sebastianraschka.com/p/technical-deepseek) — Substack article · 22 images · ~14 KB · last updated Jan 1, 2026. Fetched 2026-05-15.
