---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 2
tier: seen
---

# SGLang

Open-source LLM serving / inference framework. Often paired with [[vLLM]] in coverage of inference-side accelerator support; relevant target for [[Google]]'s TPU push and [[AWS]]'s [[Trainium3]].

## Synthesis

Thin (1 source). Mentioned as a near-peer of vLLM in inference-engine coverage — when PyTorch XLA RFC #9684 lands, both vLLM and SGLang plan to evaluate switching to native [[PyTorch]]-on-TPU rather than the current PyTorch→[[JAX]] (TorchAX) translation path.

## Observations

- Plans, alongside [[vLLM]], to evaluate switching to native PyTorch-on-TPU once PyTorch XLA RFC #9684 ships. — [[2026-04-20-google-tpuv7-deep-dive]]
