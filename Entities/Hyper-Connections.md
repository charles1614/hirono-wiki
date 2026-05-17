---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 3
tier: active
---

# Hyper-Connections

Zhu et al. 2024 technique replacing single residual stream with multiple parallel residual streams + learned Pre/Post/Res mappings between them

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Hyper-Connections (Zhu et al., arXiv 2409.19606, 2024) replace the single residual stream in a transformer block with several parallel residual streams plus learned mappings between them: a Pre Mapping combines the parallel streams into one normal hidden vector for the Attention/MoE layer, the layer output goes through a Post Mapping that distributes back across the parallel streams, and a Res Mapping linear transformation mixes streams across layers. — [[2026-05-17-recent-developments-in-llm-architectures]]
- FLOPs overhead is small because the extra mappings operate over the small residual-stream axis (e.g. n=4) rather than the full hidden dimension. In a 7B [[OLMo]] MoE experiment, FLOPs/token went from 13.36G to 13.38G — modest but consistent gains, with metrics reaching baseline using roughly half the training tokens. Extended by [[Manifold-Constrained Hyper-Connections]] (mHC) used in [[DeepSeek-V4]]. — [[2026-05-17-recent-developments-in-llm-architectures]]
