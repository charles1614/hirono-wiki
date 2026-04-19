---
created: 2026-04-19T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 14
tier: active
---

# Trainium3

AWS's third-generation training accelerator; successor to Trainium2. Designed as a credible NVIDIA alternative for training and inference of large language models.

## Synthesis

Day-0 training performance is competitive on dense models (~43% BF16 MFU with stock PyTorch, up to ~60% with hand-written NKI kernels) but weaker on MoE (~20–30% stock, ~40% NKI). Adoption is currently gated by the absence of Logical NeuronCore (LNC) = 8 support, which the broader ML research community prefers over the LNC=1/2 modes shipped at Day 0.

## Observations

- Day-0 software support is limited to LNC = 1 or LNC = 2; LNC = 8 preferred by mainstream researchers is missing, slowing adoption. — [[2026-04-19-aws-trainium3-deep-dive]]
- Dense training MFU on Qwen: ~43% BF16 with stock PyTorch native backend + torch.compile. — [[2026-04-19-aws-trainium3-deep-dive]]
- With hand-crafted NKI kernels: ~60% BF16 MFU on dense text models, ~40% on sparse MoE (DeepSeek-style 8-of-256 active experts). — [[2026-04-19-aws-trainium3-deep-dive]]
