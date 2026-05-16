---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 6
tier: active
---

# FSDP

PyTorch Fully Sharded Data Parallel — shards parameters, gradients, and optimizer state across GPUs for memory-efficient distributed training

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- VeOmni uses [[FSDP]] as one of its composable parallel primitives; combining FSDP with Ulysses for 480P/720P T2V/I2V tasks reduces peak GPU memory to 45% of baseline. — [[2025-08-06-字节跳动-veomni-框架开源-统一多模态训练效率飞跃]]
- [[slime]] added FSDP2 as a training backend (alongside Megatron-LM), enabling flexible model support for architectures with innovations like Qwen3-Next/gpt-oss; documented in Awesome-ML-SYS-Tutorial as enabling VLM RL. — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
