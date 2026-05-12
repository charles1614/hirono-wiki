---
created: 2026-05-11
updated: 2026-05-11
type: entity
refs: 2
tier: active
---

# Megatron-LM

NVIDIA's original tensor + pipeline + data parallelism training framework; foundational reference for large-model training; now subsumed into Megatron-Core.

## Synthesis

NVIDIA's foundational large-model training framework — defines the canonical tensor + pipeline + data parallelism partitioning that the rest of the ecosystem benchmarks against. **Flux's training comparison** uses Megatron-LM as the non-overlap baseline (Flux delivers 1.24× over Megatron-LM on 128-GPU clusters). **Megatron-Core**, the modern productization, is where **MoE Parallel Folding** ships — making it the production path for NVIDIA-published MoE pretraining recipes.

## Observations

- Flux's training benchmark uses Megatron-LM as the non-overlap baseline — measured on 128-GPU clusters spanning A100/H800 + PCIe/NVLink with 2DP × 8PP × 8TP. Flux delivers 1.24× speedup over Megatron-LM at the high end (1.38× over TransformerEngine specifically). — [[2025-10-09-flux-fast-software-based-communication-o]]
- MoE Parallel Folding ships in **NVIDIA/Megatron-LM** (the open-source repo) as **Megatron-Core** — the production-path implementation of decoupled attention vs MoE parallelism mappings. Not theoretical; the technique is the documented Megatron recipe. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
