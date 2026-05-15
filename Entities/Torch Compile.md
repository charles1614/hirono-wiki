---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# Torch Compile

PyTorch 2.x's compilation path that fuses operators and emits optimized kernels (Inductor backend).

## Observations

- [[vLLM]] uses `torch.compile` infrastructure (not hand-coded fusion) to automatically fuse AllReduce+RMSNorm and Pad+Quant+Finalize+Slice operations for `gpt-oss-120b` on Blackwell; the Pad+Quant fusion (PR30647) is projected to deliver 6% additional speedup; approach reduces engineering overhead compared to maintaining per-op hand-coded kernels. — [[2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par]]
