---
created: 2026-04-19T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 3
tier: active
---

# Anthropic

LLM research lab. Primary AWS customer for custom-silicon training and inference; runs on [[Trainium3]] via a custom inference engine and all-custom [[NKI]] kernels.

## Synthesis

Thin (1 source). Has an unusually deep integration with AWS's accelerator stack — implies internal NKI expertise that the broader market doesn't yet have.

## Observations

- Runs training and inference on Trainium via a custom engine built on all-custom NKI kernels — distinct from the private vLLM v1 fork used for Bedrock workloads. — [[2026-04-19-aws-trainium3-deep-dive]]
