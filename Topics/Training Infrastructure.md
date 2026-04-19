---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Training Infrastructure

Hardware, kernels, compilers, and orchestration layers that ML workloads run on. This topic weaves the physical reality (accelerators, memory hierarchies) with the software stack (kernel languages, graph compilers, frameworks) that makes training feasible at scale.

## Current understanding

A new accelerator enters the market bearing a four-legged stool: silicon, a kernel language (CUDA, NKI, Triton analog), a graph compiler (XLA-like), and a framework bridge (PyTorch backend). Any missing leg puts a ceiling on adoption. [[AWS]]'s [[Trainium3]] rollout illustrates this explicitly — Phase 1 PyTorch + [[NKI]] compiler is the minimum viable kit; Phase 2 JAX + XLA broadens the audience. Even with the first three legs, choice of dispatch granularity (LNC=1/2 vs LNC=8) gates who can use it.

Gap between stock and hand-tuned is wide: stock PyTorch delivers ~43% BF16 MFU on dense Qwen on Trainium3; NKI kernels push to ~60%. MoE remains weaker across both paths.

## Open threads

- What's the MFU-delta pattern on competing accelerators (H100/B200)? Without a comparison this topic floats untethered.
- Does the stock-vs-hand-tuned gap shrink or grow as compilers mature?

## Sources drawn on

- [[2026-04-19-aws-trainium3-deep-dive]] — AWS Trainium3 software stack and Day-0 training MFU
