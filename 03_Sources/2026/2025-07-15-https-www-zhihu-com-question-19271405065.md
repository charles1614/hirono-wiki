---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://www.zhihu.com/question/1927140506573435010/answer/1927892108636849910?share_code=t5Nk5rz1rMPE&utm_psn=1928367309795361809
tags: [model-architecture, inference-optimization, moe]
---

# [2025-07-15] Kimi K2 Model Architecture: Inference-Side Reasoning (Zhihu)

## TL;DR

A Moonshot AI inference engineer explains the four structural differences between [[Kimi K2]] and [[DeepSeek-V3]] — more experts (384 vs 256), fewer attention heads (64 vs 128), only 1 dense layer, and ungrouped router — and shows how each was chosen to keep training and inference cost comparable to DeepSeek-V3 while achieving lower loss via a sparsity scaling law.

## Key claims

- [[Kimi K2]] fully inherits [[DeepSeek-V3]]'s architecture; all proposed structural alternatives that differed from DSv3 were beaten by or merely tied with DSv3 in scaling experiments, so the team kept the same structure and only tuned hyperparameters.
- `num_experts = 384` (vs DSv3's 256): driven by a pretrain sparsity scaling law showing that increasing total MoE params at fixed activated params reduces loss without overfitting — this is the primary loss-reduction lever alongside [[MuonClip]].
- `num_attention_heads = 64` (vs DSv3's 128): halving heads reduces QKVO projection params by ~5B (DSv3 activates 37B, K2 activates 32B), recovers the decode memory cost of larger MoE, and cuts the quadratic attention term in prefill — critical for K2's long-context agent/vibe-coding target use-case.
- `first_k_dense = 1` (vs DSv3's 3): first MoE layer is hard to load-balance (observed in both DeepSeek and Kimi training), so K2 keeps only layer 1 as dense; subsequent layers all MoE with no issue.
- `n_group = 1` (no expert grouping): at large EP sizes each GPU has very few experts so group-level balancing loses value; EPLB (dynamic reranking + redundant experts) handles load balance more effectively than grouping.
- Under EP=128, K2's extra MoE params add ~2.5 GB/rank, but cutting attention heads saves ~5 GB/rank from QKVO projections — net decode cost lower than DSv3 despite 1.5× more total parameters.
- Prefill is largely compute-bound when seq length is long; K2's lower FLOPS from reduced attention partially offsets MoE growth.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[Kimi K2]], [[DeepSeek-V3]], [[MuonClip]], [[MLA]], [[Expert Parallelism]], [[MoE]]

## Topics touched

[[MoE Training]], [[MoE Serving]], [[Expert Parallelism]], [[Decoding Optimization]]

## Raw source

[zhihu.com/question/1927140506573435010](https://www.zhihu.com/question/1927140506573435010/answer/1927892108636849910?share_code=t5Nk5rz1rMPE&utm_psn=1928367309795361809) — Zhihu answer by 刘少伟 (Moonshot AI inference), 2025-07-15. Read 2026-05-16.
