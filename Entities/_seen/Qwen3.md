---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 2
tier: seen
---

# Qwen3

Alibaba's open-weight MoE language model series released May 2025

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Raschka comparison vs gpt-oss-20B: Qwen3-30B-A3B is 48 transformer blocks (vs gpt-oss's 24), 2048 embedding dim (vs 2880), 128 experts / 8 active (vs 32 / 4 active); depth-first vs gpt-oss's width-first; Gemma 2 ablation (9B scale) finds wider slightly better (52.0 vs 50.8 avg across 4 benchmarks); Qwen3 uses no sliding window attention. — [[2025-09-03-from-gpt-2-to-gpt-oss-analyzing-the-arch]]
