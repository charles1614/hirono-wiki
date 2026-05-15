---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 17
---

# LLM Training Systems

## What

End-to-end systems for training large language models — frameworks, parallelism, communication, data loading.

## Current understanding

No cited Sources have been ingested for this Topic yet. The section below is a structural placeholder; it will be replaced with an evidence-grounded synthesis once Sources are attached.

**LLM training systems** span the full pipeline from raw data to a trained checkpoint: data loading and preprocessing, distributed parallelism strategies (data, tensor, pipeline, sequence, expert), optimizer state management, mixed-precision and quantization schemes, communication collectives (AllReduce, AllGather, ReduceScatter), checkpointing, and monitoring/debugging tooling.

The dominant open frameworks as of early 2026 are **Megatron-LM** (NVIDIA; tensor + pipeline parallelism for transformer layers), **DeepSpeed** (Microsoft; ZeRO optimizer sharding, offload to CPU/NVMe), **PyTorch FSDP / FSDP2** (Meta; fully-sharded data parallel as a native PyTorch primitive), and **torchtitan** (Meta; modular reference implementation built on FSDP2 + torch.compile). **JAX + XLA** (used internally at Google/DeepMind) offers a functional, compiler-first alternative. These frameworks are not mutually exclusive: DeepSpeed + Megatron-LM co-usage (used for GPT-NeoX, Llama-family pre-training runs) is a common production pattern.

**Parallelism taxonomy**: Data parallelism replicates the model across devices and shards the batch; tensor parallelism splits individual weight matrices across devices within a layer; pipeline parallelism assigns consecutive layer groups to different devices and uses micro-batching to hide bubble overhead; sequence parallelism splits the activation sequence dimension (used alongside tensor parallelism to reduce per-device activation memory); expert parallelism distributes MoE experts across devices. Production runs combine all five (3D or 5D parallelism), with the parallelism degrees chosen jointly to maximize MFU (Model FLOP Utilization) given interconnect topology.

**Communication bottlenecks** are the central engineering constraint. Within a node, NVLink provides ~600 GB/s bidirectional bandwidth; across nodes, InfiniBand HDR/NDR delivers ~200–400 Gb/s. Tensor parallelism is communication-intensive and is therefore kept within a single node (or NVLink domain); pipeline and data parallelism cross nodes. Overlapping compute and communication (e.g., gradient all-reduce overlapped with the backward pass) is standard practice to hide latency.

**Memory** is the other primary constraint. The ZeRO (Zero Redundancy Optimizer) family (ZeRO-1/2/3) partitions optimizer states, gradients, and parameters across data-parallel ranks, trading extra communication for linear memory reduction. Activation recomputation (also called gradient checkpointing) trades FLOPs for memory by recomputing activations during the backward pass rather than storing them. Mixed precision (BF16 forward/backward, FP32 master weights and optimizer states) is now the default; FP8 training is emerging for frontier runs.

Once Sources are attached, this section should be revised to anchor each claim to a specific `<source-slug>` and to surface any inter-source disagreements (e.g., differing MFU benchmarks, competing parallelism strategies, framework adoption claims).

**Per-device memory structure** during a training step decomposes into five zones: parameters (static), activations (forward pass; retained until next forward overwrites them), gradients (backward), optimizer state ([[AdamW]]: 2NP bytes for two moments), and optimizer intermediates (transient during update). Peak memory depends on batch size — large batches peak during the forward pass; small batches during the optimizer step. [[PyTorch]]'s `torch.cuda.memory._record_memory_history` + pytorch.org/memory_viz provides per-event visibility into these zones. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]

## Open threads

## Sources drawn on

- [[2026-02-28-deepwiki-slime-01-overview]] — slime RL post-training framework: three-subsystem architecture (Megatron-LM + SGLang + Ray), colocated vs. dedicated GPU modes, async pipelining design.
- [[2026-03-18-阶跃星辰开源全量-sft-数据集-欢迎使用-小红书]] — StepFun Step 3.5 Flash SFT dataset release: 17B tokens, multi-turn + CoT, SteptronOss training framework, preprocessed shards + tokenizer.
- [[2026-01-22-deepwiki-pytorch-02-core-tensor-library]] — DeepWiki PyTorch architecture overview covering the full stack from Python API to C++ core (c10, ATen, autograd) and compiler layers (Dynamo, FX, Inductor).
- [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]] — Megatron-LM attention mechanisms: MHA, GQA, MLA, FlashAttention backends, RoPE, TP sharding patterns.
- [[2026-01-21-deepwiki-megatron-lm-13-feedforward-netw]] — Megatron-LM MLP block: standard vs GLU variants, TP partitioning, fused kernels, activation checkpointing.
- [[2026-01-21-deepwiki-megatron-lm-08-context-parallel]] — Megatron-LM Context Parallelism: sequence-dimension sharding, communication strategies, hierarchical CP, TP orthogonality.
