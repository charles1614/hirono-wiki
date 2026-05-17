---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Sequence Parallelism

Distributed training technique splitting input sequences across GPUs to reduce memory for long-context training

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Combining Ulysses (head-dimension split) + Ring-Attention (sequence-dimension ring) enables SP degree to exceed the attention-head count limit; SWIFT implements both in a backbone forward hook for seamless multimodal and padding-free compatibility; enabling `--sequence_parallel_size 8` with zigzag ring achieves 4.2× memory reduction at 4× training time on Qwen2.5-3B at 65K tokens. — [[2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现]]
