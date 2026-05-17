---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 4
tier: active
---

# Manifold-Constrained Hyper-Connections

DeepSeek-V4 residual-path technique: n=4 parallel residual streams with Res Mapping projected onto doubly stochastic matrices for stable signal flow

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Manifold-Constrained Hyper-Connections (mHC), introduced in arXiv 2512.24880 (DeepSeek, 31 Dec 2025) and deployed in [[DeepSeek-V4]], extends [[Hyper-Connections]] by constraining the residual mappings: the Res Mapping matrix is projected onto the manifold of doubly stochastic matrices (non-negative, each row and column sums to 1), and the Pre/Post Mappings are constrained non-negative and bounded. This makes residual stream mixing behave like a stable redistribution rather than amplifying or shrinking signals across deep stacks. — [[2026-05-17-recent-developments-in-llm-architectures]]
- DeepSeek-V4 uses n=4 parallel residual streams. The DeepSeek-optimized implementation (with fusion, recomputation, pipeline scheduling) reports only 6.7% additional training-time overhead at n=4 vs the single-stream baseline in the original 27B-scale mHC paper. — [[2026-05-17-recent-developments-in-llm-architectures]]
