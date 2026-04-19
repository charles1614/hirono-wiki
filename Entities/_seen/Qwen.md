---
created: 2026-04-19T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 2
tier: seen
---

# Qwen

Alibaba's open-weight LLM family. Commonly used as a benchmark and serving target (both dense and MoE variants).

## Synthesis

Appears in the Trainium3 MFU benchmarks as a stand-in for "typical modern dense and MoE architectures." Dense Qwen numbers are the more flattering measurement; MoE numbers expose the real gap.

## Observations

- Qwen dense: ~43% BF16 MFU on Trainium3 with stock PyTorch; ~60% with hand-written NKI kernels. — [[2026-04-19-aws-trainium3-deep-dive]]
- Qwen MoE: 20–30% MFU stock PyTorch; up to 40% with hand-crafted NKI kernels. — [[2026-04-19-aws-trainium3-deep-dive]]
