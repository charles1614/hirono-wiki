---
created: 2026-04-19
updated: 2026-04-19
type: source
raw_source: https://newsletter.semianalysis.com/p/aws-trainium3-deep-dive-a-potential
tags: [trainium, aws, accelerator, tco]
highlights: true
---

# [2026-04-19] AWS Trainium3 Deep Dive — a potential challenger approaching

## TL;DR

[[AWS]] is making [[Trainium3]] credible as an NVIDIA alternative by widening its software story from a narrow internal toolchain into a public-facing open-source stack: a native [[PyTorch]] backend with `torch.compile`, the [[NKI]] kernel language compiler, and matmul/ML-ops libraries — with [[JAX]] and XLA to follow. On Day 0 this delivers 43% BF16 MFU on dense [[Qwen]] via stock PyTorch, up to ~60% MFU with hand-written NKI kernels; MoE is weaker (20–30% stock, up to 40% NKI for DeepSeek-like 8-of-256 experts).

## Key claims

- AWS's software "North Star" is broadening from perf/TCO tuning for internal [[Bedrock]] workloads and [[Anthropic]] training/inference toward a public toolchain that third parties can adopt.
- Phase 1 of the shift: open-source a native PyTorch backend, the NKI compiler, and NKI kernel + communication libraries (AWS's analogues to NCCL, cuBLAS, cuDNN, ATen ops).
- Phase 2: open-source the XLA graph compiler and the JAX stack.
- Day-0 hardware support is only for Logical NeuronCore (LNC) = 1 and LNC = 2. Elite kernel engineers at AWS/Anthropic prefer these; the broader ML research community prefers LNC = 8, whose absence will slow adoption.
- Day-0 training MFU on Qwen dense models: ~43% BF16 with stock PyTorch native backend + `torch.compile`.
- With hand-crafted NKI kernels: Trainium3 sustains ~60% BF16 MFU on dense text models, ~40% on sparse MoE (e.g., DeepSeek 670B, 8 of 256 experts per token).
- Internal [[Anthropic]] inference uses a custom engine and all-custom NKI kernels; internal [[Bedrock]] serves [[DeepSeek]]/[[Qwen]] via a private vLLM v1 fork.

## Entities touched

[[AWS]], [[Trainium3]], [[Anthropic]], [[PyTorch]], [[NKI]], [[Bedrock]], [[Qwen]], [[DeepSeek]], [[JAX]]

## Topics touched

[[Training Infrastructure]], [[Accelerator Economics]]

## Open questions

- When (and whether) AWS ships LNC = 8 support — this gating adoption among non-elite teams.
- How NKI ergonomics compare to CUDA/Triton for the median ML engineer, not the "elite L337" engineer this article gestures at.
- What the gap looks like for training: 60% MFU on dense is competitive, but the MoE gap (40% vs ~50%+ on H100/B200 class hardware) is real.
- Whether open-sourcing the compilers is enough without an open model-card ecosystem (PyTorch kernels alone don't guarantee adoption).

## Raw source

- URL: https://newsletter.semianalysis.com/p/aws-trainium3-deep-dive-a-potential
- Raindrop bookmark_id: 1576266837 (highlighted — 4 highlights preserved in full in the article)
- Captured: 2026-02-04
- Ingested: 2026-04-19
