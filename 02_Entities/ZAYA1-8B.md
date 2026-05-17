---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 6
tier: active
---

# ZAYA1-8B

Zyphra open-weight LLM (2026) with Compressed Convolutional Attention + extremely sparse MoE (1 routed expert/token), trained on AMD GPUs

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- ZAYA1-8B is developed by [[Zyphra]] and notable for being trained on AMD GPUs rather than the more common NVIDIA/TPU setup. Its `config.json` lists 80 alternating layer entries (CCA-attention and MoE feed-forward) — conceptually 40 attention+MoE pairs. Uses [[Compressed Convolutional Attention]] together with a 4:1 [[GQA]] layout. — [[2026-05-17-recent-developments-in-llm-architectures]]
- ZAYA1-8B uses an extremely sparse [[MoE]] design with only one routed expert active per token. — [[2026-05-17-recent-developments-in-llm-architectures]]
