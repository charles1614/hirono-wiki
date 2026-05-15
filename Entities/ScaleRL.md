---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# ScaleRL

Meta's RL training recipe for predictable compute scaling of LLM reinforcement learning

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Meta's RL training recipe combining PipelineRL-8 (async off-policy, k=8), CISPO truncated importance-sampling loss, FP32 logits, prompt-level loss averaging, batch-level advantage normalization, zero-variance filtering, and No-Positive-Resampling; validated over 400K GPU-hours on NVIDIA GB200s showing predictable sigmoid-saturation scaling with compute. — [[2025-10-19-meta用40万个gpu小时做了一个实验-只为弄清强化学习scaling-law]]
