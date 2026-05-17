---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 11
tier: active
---

# DeepSeek-V4

DeepSeek 2026 flagship MoE; introduces mHC residual mixing and CSA/HCA sequence-compressed attention; V4-Pro and V4-Flash variants

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DeepSeek V4 (2026) is split into V4-Pro and V4-Flash variants and was the largest release of the year by both hype and size. V4-Pro is the most parameter-sparse MoE in the 2026 surveyed cohort by active-parameter share. — [[2026-05-17-recent-developments-in-llm-architectures]]
- DeepSeek V4 introduces two orthogonal architecture changes: (1) [[Manifold-Constrained Hyper-Connections]] (mHC) on the residual path with n=4 parallel residual streams; (2) a CSA/HCA hybrid on the attention path ([[Compression Sparse Attention]] + [[Highly Compressed Attention]]) with compressed KV caches, alternating across layers and supplemented by a 128-token sliding-window branch for recent uncompressed tokens. — [[2026-05-17-recent-developments-in-llm-architectures]]
- Reported efficiency vs [[DeepSeek-V3.2]] (which uses [[MLA]] + DSA): at 1M-token context, V4-Pro uses 27% of single-token inference FLOPs and 10% of KV cache size; V4-Flash hits 10% FLOPs and 7% KV cache. V4-Flash-Base also outperforms V3.2-Base on a majority of base-model benchmarks — but this result bundles data improvements, Muon optimization, mHC, and precision/storage optimizations; no per-component ablation is reported. — [[2026-05-17-recent-developments-in-llm-architectures]]
