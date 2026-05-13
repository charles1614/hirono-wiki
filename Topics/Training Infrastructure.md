---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 0
---

# Training Infrastructure

## What

*Stub topic — to be expanded from sources.*

## Current understanding

No sources have been directly assigned to this topic yet (`source_count: 0`), so the synthesis below is a structural orientation drawn from adjacent populated topics rather than a cross-source consensus built from cited bodies.

**Training infrastructure** refers to the full hardware-software stack that makes large-scale model training feasible: accelerator hardware (GPUs, TPUs, and their interconnects), the distributed-parallelism strategies that partition work across thousands of devices, the communication collectives and networking fabric that bind those devices together, the data-loading pipelines that keep accelerators fed, and the checkpointing and fault-tolerance machinery that protects multi-week runs.

The corpus's coverage of this space currently lives in adjacent topics rather than under this heading. The parallelism dimension — specifically how TP × EP × CP × DP × PP combinations are chosen and composed for MoE models — is addressed in [[LLM Training Systems]], [[MoE Training]], [[Hybrid Parallelism]], and [[Expert Parallelism]]. The data-loading bottleneck (subprocess vs. thread-based workers, per-stage concurrency) is covered in [[Data Loading]] and [[Data Loading Pipelines]]. Accelerator hardware characteristics that constrain training choices (FP8 Tensor Core throughput, TMA async copy, NVLink/InfiniBand topology) appear in [[GPU Microarchitecture]] and [[AI Accelerators]]. Numerical-precision tradeoffs that affect training stability and hardware efficiency — FP8 pretraining, FP4 experiments — appear in [[Low-Precision Training]] and [[Numerical Precision]].

The practitioner consensus visible across the corpus's sources is that **hardware utilization (MFU) is the load-bearing metric** for training infrastructure quality. A high-MFU configuration requires matching the parallelism strategy to both the model architecture (dense vs. MoE, attention vs. FFN) and the cluster topology (intra-node NVLink vs. inter-node InfiniBand bandwidth ratios). The corpus's closest anchor source on this topic, a pointer note recommending the DeepMind "How to Scale Your Model" book and NVIDIA Megatron source code, frames it as a top-down cost-model framing (the scaling book) + bottom-up code reading (Megatron) — the two learning modalities that can't be substituted for each other.

A substantive Current understanding here will require ingesting sources that cover training infrastructure directly: the DeepMind/JAX scaling book (`jax-ml.github.io/scaling-book`), Megatron-LM's published design documents, and any corpus sources that touch checkpointing, fault recovery, or cluster topology. Until those are ingested, readers should navigate to [[LLM Training Systems]] and [[Hybrid Parallelism]] for the closest populated content.

## Open threads


## Sources drawn on

- (auto-populated by reindex)
