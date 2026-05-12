---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2406.06858
tags: [comm-overlap, parallelism, training, inference, gpu, paper]
---

# [2025-10-09] FLUX: Fast Software-Based Communication Overlap on GPUs Through Kernel Fusion

## TL;DR

ByteDance + PKU paper (Li-Wen Chang et al., arXiv:2406.06858 v5 Oct 2024) on **hiding tensor-parallel communication behind dependent computation by over-decomposing both into fine-grained tiles and *fusing them into a single kernel*** built on NVIDIA [[CUTLASS]]. Prior overlap methods (TransformerEngine, Megatron-style chunked overlap) split GEMMs into device-count-many smaller GEMMs and rely on stream/event scheduling — which works on TPUs but underutilizes GPU SMs when TP scales, and gives no precise timing control. Flux instead maps each finer (tile-level) comm+compute pair to a single thread block, with kernel-fusion-internal scheduling. **Up to 96% of communication can be overlapped.** Speedups: **1.24× over Megatron-LM training** (128 GPUs, A100/H800, PCIe/NVLink); **1.66× prefill / 1.30× decoding** over vLLM (8 GPUs). 2.06×/2.10× over TransformerEngine specifically.

## Key claims

- **The problem framing.** Tensor parallelism (TP) is the only way to shrink per-token latency once a model exceeds a GPU's memory or compute budget for the latency target. But TP introduces per-layer AllGather/ReduceScatter — Fig 1 shows this is a "substantial portion" of overall runtime in standard 2DP+8PP+8TP configs. Hiding that comm is mandatory for TP to scale.
- **Why prior comm-overlap methods underperform on GPUs**, not TPUs:
  1. **Stream/event timing is not precisely controllable** on GPUs in production with many concurrent streams.
  2. **ReduceScatter overlap requires extra add operations** between GEMMs, creating data dependence that blocks concurrent kernel execution via multiplexing.
  3. **Splitting one GEMM into N small GEMMs underutilizes SMs**. Especially as TP scales up — there's no longer enough work per kernel to fill the GPU.
- **Flux's core design choice**: don't split GEMMs across kernel boundaries. Decompose comm and compute into much finer tiles (smaller than per-device chunks), then **fuse all of them into a single large kernel**. Each (compute-tile, comm-tile) pair → one thread block. This gets:
  - **Full SM utilization** — one big kernel keeps SMs busy.
  - **In-kernel scheduling** — timing controlled by the kernel itself, not stream/event races.
  - **No artificial data-dependence stalls** — fusion sees through the deps.
- **Flux optimizations beyond fusion**: tile coordinate swizzling, GPU instruction selection, communication order selection. Built on CUTLASS modularly — auto-tunable across GPU generations (A100 / H800) and interconnects (PCIe / NVLink). The auto-tuning is load-bearing because the optimal tile size + execution order depends on the hardware.
- **Effective Communication Time (ECT) metric** to fairly compare methods:
  - `ECT = OverallTime − GEMM_non-split` (best non-split GEMM time)
  - `E_overlap = 1 − ECT_overlap / ECT_non-overlap`
  - A perfect overlap method has ECT = 0 / E_overlap = 100%. NCCL baseline = 0% efficiency. Negative E_overlap = worse than non-overlap — observed for TransformerEngine at small `m`.
- **Reported speedups**:
  - **Training (128 GPUs, 2DP × 8PP × 8TP)**: 1.24× over Megatron-LM (non-overlap baseline) at the high end. 1.38× over TransformerEngine (prior overlap method).
  - **Inference prefill (8 GPUs, 8TP)**: 1.66× over vLLM; 2.06× over TransformerEngine.
  - **Inference decoding (8 GPUs, 8TP)**: 1.30× over vLLM; 2.10× over TransformerEngine.
  - **Comm overlap rate**: up to 96% of comm hidden by dependent compute.
- **Scope**: handles AllGather + ReduceScatter (the two patterns from sharded-activation Megatron TP). Also extends to AlltoAll (relevant for MoE expert parallelism, though MoE isn't the headline). Doesn't address weight-AllGather patterns (already prefetch-overlappable so not the bottleneck).
- **MLP-shape worked example** (Fig 2): TP-N partitioning where W1 shards along rows (AllGather inputs before GEMM); W2 shards along columns (ReduceScatter output after GEMM). Backward swaps the two. The Flux kernel-fusion strategy applies to both halves.

## Visual observations

**Figure 1 — Non-overlapped communication portion in TP workloads** (load-bearing)

![Bar chart showing % of total runtime spent on non-overlapped communication across multiple 128-GPU training and 8-GPU inference clusters — substantial fractions across A100/H800, PCIe/NVLink](../../raw/raindrop/arxiv.org/2025-10-09-flux-fast-software-based-communication-o/2025-10-09-flux-fast-software-based-communication-o-figures/marker-page-001-000.jpeg)

This is the "why bother" chart. Without it, the motivation is hand-wavy; with it, the size of the prize is concrete.

**Figure 2 — MLP forward partitioning (AllGather + ReduceScatter)** (load-bearing)

![Diagram of MLP forward across N devices: W1 sharded by rows + AllGather inputs; W2 sharded by columns + ReduceScatter outputs. Standard Megatron-LM partitioning with sharded activations](../../raw/raindrop/arxiv.org/2025-10-09-flux-fast-software-based-communication-o/2025-10-09-flux-fast-software-based-communication-o-figures/marker-page-002-000.jpeg)

Sets up the comm pattern Flux targets. Anyone implementing Flux needs to understand this shape.

**Figure 4 — TransformerEngine sometimes slower than non-overlap PyTorch** (load-bearing)

![Performance comparison from m=1024 to m=8192: TransformerEngine (prior overlap method) is faster at large m but slower than PyTorch non-overlap baseline at small m on 8-H800 NVLink](../../raw/raindrop/arxiv.org/2025-10-09-flux-fast-software-based-communication-o/2025-10-09-flux-fast-software-based-communication-o-figures/marker-page-004-000.jpeg)

The "prior overlap can be negative" empirical proof — directly motivates the SM-underutilization argument and the need for kernel fusion vs kernel splitting.

- **Figure 3 — Prior GEMM-ReduceScatter overlap (2-way TP)** (supporting): illustration of the chunked-overlap scheme Flux is improving on. Useful for understanding the comparison.

## What this changes

- **For training stacks** (Megatron-LM, DeepSpeed): kernel-fusion comm overlap is a recipe to extract another ~20% throughput at TP-heavy configurations. The Flux author list points at ByteDance shipping this; expect upstreaming or equivalents.
- **For inference stacks** (vLLM, [[SGLang]], [[TensorRT-LLM]]): the prefill 1.66× / decode 1.30× gains specifically apply to TP-only deployment. Composable with disaggregation ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) — Flux improves the within-pool execution, disagg improves the across-pool pipeline.
- **For kernel authors**: the design pattern is "fuse comm primitives into compute kernels, don't schedule them as independent kernels." This is a generalizable lesson — relevant to flash-attention-style fusions and any latency-bound producer-consumer pair on GPUs.
- **For CUTLASS as platform**: validates CUTLASS as the right substrate for next-gen fused kernels. Counter-example to "we should write everything in Triton."

## Entities touched

[[ByteDance]], [[CUTLASS]], [[Megatron-LM]], [[Transformer Engine]], [[vLLM]], [[NCCL]], [[NVLink]], [[A100]], [[H800]]

## Topics touched

[[Tensor Parallelism]], [[Communication-Computation Overlap]], [[Kernel Fusion]], [[LLM Training Systems]], [[LLM Inference Systems]]

## Raw source

[arxiv.org/abs/2406.06858](https://arxiv.org/abs/2406.06858) — 21-page paper · 3.2 MB PDF · 16 figures (Marker-extracted) + 17 captioned arxiv-HTML figures. ByteDance + PKU. Read 2026-05-11 (Marker re-extraction).
