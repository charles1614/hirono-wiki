---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: entity
refs: 3
tier: active
---

# Megatron-LM

NVIDIA's original tensor + pipeline + data parallelism training framework; foundational reference for large-model training; now subsumed into Megatron-Core.

## Synthesis


NVIDIA's open-source large-model training framework and canonical reference implementation for hybrid parallelism — it defines the tensor, pipeline, and data parallelism partitioning patterns that the broader ecosystem benchmarks against. Flux (ByteDance + PKU) uses Megatron-LM as its non-overlap baseline, achieving a 1.24× speedup over it on 128-GPU clusters (A100/H800, PCIe/NVLink) via kernel-fusion-based communication overlap — measuring the gap Megatron-LM's stream/event scheduling leaves on the table. Megatron-Core, the production-grade subpackage within the same repo, is where MoE Parallel Folding ships: NVIDIA's technique for decoupling the parallelism mappings of attention and MoE layers independently, achieving 49.3% MFU on Mixtral 8×22B at 1,024 H100 GPUs. Practitioners treating distributed training infrastructure seriously treat Megatron source-reading as effectively mandatory — pairing the codebase bottom-up with the DeepMind "How to Scale Your Model" book for the top-down cost-model framing.


## Observations

- Flux's training benchmark uses Megatron-LM as the non-overlap baseline — measured on 128-GPU clusters spanning A100/H800 + PCIe/NVLink with 2DP × 8PP × 8TP. Flux delivers 1.24× speedup over Megatron-LM at the high end (1.38× over TransformerEngine specifically). — [[2025-10-09-flux-fast-software-based-communication-o]]
- MoE Parallel Folding ships in **NVIDIA/Megatron-LM** (the open-source repo) as **Megatron-Core** — the production-path implementation of decoupled attention vs MoE parallelism mappings. Not theoretical; the technique is the documented Megatron recipe. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- **Practitioner-recommended source-reading priority** for training-infra learners. Per Jason 武器库's xhs comment: "if you're doing infra anyway, there's almost no way to skip reading source." Pairs as the canonical-implementation reference alongside the DeepMind scaling book (top-down conceptual + bottom-up source-read pairing). — [[2026-04-16-我在-汪志鹏的笔记下发布了一条评论-训练-infra-最好的资料应该就是-dee]]
