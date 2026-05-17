---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Ulysses

Sequence parallelism algorithm from DeepSpeed that all-to-all exchanges activations so each GPU computes subset of attention heads

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Ulysses (DeepSpeed) performs all-to-all activation exchange before attention so each GPU holds the full sequence but only a subset of attention heads; avoids O(N²) memory growth per head but is limited by the number of KV heads in GQA settings, making it complementary to Ring-Attention which has no head-count constraint. — [[2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现]]
