---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 2
tier: seen
---

# ByteCheckpoint

distributed checkpointing system for large foundation model training, from ByteDance

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- ByteCheckpoint (NSDI'25, ByteDance) uses a ShardMeta representation (fqn, nD_offsets, nD_lengths) that is independent of runtime parallelism, enabling automatic load-time checkpoint resharding without offline scripts; achieves 54.20× average reduction in checkpoint stalls and 12.13–161.50× improvement vs PyTorch DCP and Megatron DCP baselines; scales to 405B LFM training on 8,960 GPUs. — [[2025-03-06-2407-20143]]
