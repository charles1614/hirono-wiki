---
created: 2026-05-11T00:00:00.000Z
updated: '2026-05-11'
type: topic
source_count: 3
---

# Attention Kernels

## What

*Stub topic — to be expanded from sources.*

## Current understanding

*Synthesis pending. See Sources drawn on below.*

## Open threads

- (to be filled in)
- TE limitations as of the Feb-2024 HKUST paper (Softmax / GeLU not FP8-quantized, DotProductAttention bypasses FP8 TC) — do they still hold in 2025/2026 TransformerEngine versions? FP8 LLM stacks have matured substantially since. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- Why does DeepSeek not TP decode? FlashMLA asserts this as fact without justification; decode-side TP is a common KV-bandwidth optimization. There's an architectural / serving-economics reason worth understanding. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- FlashMLA's seesaw schedule is designed for 2 warpgroups + Hopper register budget. Does it generalize to 4 warpgroups on Blackwell (larger register file + different WGMMA shape)? — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- MLA piggyback overhead mitigation (cache up-projected KV from earlier chunks, per the NVIDIA Beyond-the-Buzz paper) — is this in any OSS serving stack yet? FlashMLA is the obvious candidate. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]


## Sources drawn on

- (auto-populated by reindex)
