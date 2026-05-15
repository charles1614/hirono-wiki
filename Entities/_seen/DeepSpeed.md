---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# DeepSpeed

Microsoft's distributed training framework mentioned alongside Megatron-LM as a training stack expected to benefit from FLUX-style kernel-fusion comm overlap.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DeepSpeed's Ulysses sequence parallelism performs all-to-all activation exchange before attention so each GPU holds the full sequence but only a subset of attention heads; limited by number of KV heads in GQA; naturally composable with Ring-Attention for SP degree exceeding head count. — [[2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现]]
