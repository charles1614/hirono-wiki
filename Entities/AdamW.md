---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# AdamW

Adaptive gradient optimizer used to train the EAGLE-3 draft model, with learning rate 5e-5 and gradient clipping 0.5.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Stores two moments (first and second) per parameter, making optimizer state size 2NP bytes — the largest single memory zone in a training loop when batch size is small. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
