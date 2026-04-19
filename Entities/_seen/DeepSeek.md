---
created: 2026-04-19
updated: 2026-04-19
type: entity
refs: 1
tier: seen
---

# DeepSeek

Chinese AI lab. Produces open-weight MoE and dense models widely used as cost-efficient frontier-adjacent alternatives.

## Synthesis

Appears in Trainium3 material as the archetypal "sparse MoE with 8-of-256 active experts" benchmark, representative of the MoE-heavy direction the field is moving.

## Observations

- DeepSeek 670B (8 of 256 experts active per token) is the reference MoE benchmark for Trainium3; NKI kernels reach ~40% BF16 MFU on this class of model. — [[2026-04-19-aws-trainium3-deep-dive]]
- Served on Bedrock via the private vLLM v1 fork. — [[2026-04-19-aws-trainium3-deep-dive]]
