---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://arxiv.org/abs/2508.09834
tags: [survey, training, inference, gpu, parallelism]
---

# [2025-08-13] Speed Always Wins: A Survey on Efficient Architectures for Large Language Models

## TL;DR

82-page survey systematically reviews efficient LLM architectures that overcome the quadratic and memory bottlenecks of standard Transformers. Covers linear and sparse sequence models, efficient attention variants, sparse MoE, hybrid architectures, and diffusion LLMs, with applications across modalities.

## Key claims

- Linear and sparse sequence modeling methods (SSMs, linear attention) replace O(n²) attention with subquadratic or linear-time alternatives, enabling longer context at lower compute cost.
- Efficient full-attention variants reduce memory and compute via sparse patterns, sliding windows, and low-rank approximations while preserving expressive capacity.
- Sparse Mixture-of-Experts (MoE) scales model capacity without proportionally increasing per-token FLOPs; expert routing quality and load balancing are central design axes.
- Hybrid architectures interleave dense attention layers with linear or convolutional layers to balance recall-heavy tasks (needing full attention) against throughput-heavy tasks (favoring subquadratic layers).
- Diffusion LLMs represent an emerging generation of non-autoregressive architectures enabling parallelism across output tokens, challenging the autoregressive generation monopoly.
- The survey frames efficiency as multi-dimensional: training FLOPs, memory footprint, inference latency, and deployment flexibility are often traded off differently across architecture families.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[NVIDIA]]

## Topics touched

[[LLM Architectures]], [[Parallelism Strategies]]

## Raw source

[arxiv.org/abs/2508.09834](https://arxiv.org/abs/2508.09834) — arXiv preprint cs.CL; Weigao Sun et al. (15 authors); v1 2025-08-13. Read 2026-05-15.
