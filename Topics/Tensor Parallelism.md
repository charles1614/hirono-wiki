---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 3
---

# Tensor Parallelism

## What

*Stub topic — to be expanded from sources.*

## Current understanding

**Tensor parallelism (TP)** is the technique of sharding individual weight matrices across multiple GPUs so that each forward pass requires only a fraction of the full computation per device, with AllGather and ReduceScatter collectives used to assemble correct outputs. The canonical Megatron-LM partitioning splits MLP layers so that W1 shards along rows (requiring AllGather of activations before the GEMM) and W2 shards along columns (requiring ReduceScatter of the output after the GEMM); the backward pass swaps the two. This pattern is the only practical way to reduce per-token latency once a model exceeds a single GPU's memory or compute budget for a given latency target.

The central cost of TP is communication: every transformer layer introduces at least two collectives on the critical path. [[2025-10-09-flux-fast-software-based-communication-o]] measures this directly — in standard 2DP × 8PP × 8TP training configurations on 128 A100/H800 GPUs, non-overlapped AllGather/ReduceScatter is a "substantial portion" of overall runtime. This is the main reason TP is bounded in practice: increasing TP degree increases the collective volume and the number of per-layer barriers.

The dominant mitigation strategy is **communication-compute overlap**, implemented by decomposing the GEMM into tiles and launching comm and compute tiles concurrently. Prior approaches (Megatron-style chunked overlap, TransformerEngine) split GEMMs into N sub-GEMMs and use stream/event scheduling — which underutilizes SMs when TP scales because the smaller GEMMs don't fill the GPU. [[2025-10-09-flux-fast-software-based-communication-o]] (FLUX, ByteDance + PKU) addresses this by fusing comm tiles and compute tiles into a single large kernel via CUTLASS, with in-kernel scheduling rather than stream scheduling. This reaches up to 96% comm overlap and delivers 1.24× training throughput over Megatron-LM and 1.66× prefill / 1.30× decoding throughput over vLLM at 8-GPU TP. The generalizable principle: fuse comm primitives into compute kernels rather than scheduling them as independent kernel launches.

In **MoE architectures**, TP interacts with Expert Parallelism (EP) in ways that expose a second class of inefficiency. Classical frameworks forced EP to be a sub-group of DP, capping EP degree at ≤ DP. [[2025-10-28-moeparallel-folding-heterogeneous-parall]] (MoE Parallel Folding, NVIDIA / Megatron-Core) shows that attention layers and MoE layers have fundamentally different optimal parallelism regimes: attention is whole-sequence dense and prefers TP + Context Parallelism (CP), while MoE is per-token sparse and prefers EP (cheaper per-token comm than Expert-TP). The paper decouples the two, giving attention its own `TP × CP × DP × PP` group and MoE its own `TP × EP × DP × PP` group with only PP forced to match. Result: 49.3% MFU on Mixtral 8×22B and 39.0% MFU on Qwen2-57B-A14B at 1,024 H100 GPUs, shipped in production Megatron-Core.

A counter-pattern worth noting: DeepSeek's FlashMLA decoding stack deliberately avoids TP for its decode instances, keeping `h_q = 128` so the MLA kernel stays compute-bound rather than memory-bound ([[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]). This illustrates that TP is not always the right axis to scale decode — when the attention-head count is high enough relative to the hardware's compute-memory crossover, skipping TP preserves the compute-bound regime and avoids the collective overhead.

**Where sources agree**: TP communication is the primary bottleneck as TP degree increases; overlap (kernel-fusion-based or otherwise) is mandatory for TP to scale efficiently; and for MoE, EP is significantly more comm-efficient than sharding experts via TP.

**Open question**: the sources cover training-time overlap (FLUX) and MoE-specific decoupling (Parallel Folding) but say little about optimal TP degree selection heuristics for dense-model inference across different hardware interconnect topologies (NVLink vs. PCIe vs. InfiniBand), or how TP interacts with speculative decoding or chunked prefill pipelines.

## Open threads


## Sources drawn on

- (auto-populated by reindex)
