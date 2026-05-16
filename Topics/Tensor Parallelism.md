---
created: 2026-05-11
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 11
---

# Tensor Parallelism

## What

*Stub topic — to be expanded from sources.*

## Current understanding

**Tensor parallelism (TP)** is the technique of sharding individual weight matrices across multiple GPUs so that each forward pass requires only a fraction of the full computation per device, with AllGather and ReduceScatter collectives used to assemble correct outputs. The canonical Megatron-LM partitioning splits MLP layers so that W1 shards along rows (requiring AllGather of activations before the GEMM) and W2 shards along columns (requiring ReduceScatter of the output after the GEMM); the backward pass swaps the two [[2025-10-09-flux-fast-software-based-communication-o]]. This is the only practical way to reduce per-token latency once a model exceeds a single GPU's memory or compute budget for a given latency target.

The central cost of TP is communication: every transformer layer introduces at least two collectives (AllGather + ReduceScatter) on the critical path. [[2025-10-09-flux-fast-software-based-communication-o]] measures this directly — in standard 2DP × 8PP × 8TP training configurations on 128 A100/H800 GPUs, non-overlapped AllGather/ReduceScatter constitutes a "substantial portion" of overall runtime. This is the main reason TP is bounded in practice: increasing TP degree increases collective volume and the number of per-layer barriers.

The dominant mitigation is **communication-compute overlap**, implemented by decomposing the GEMM into tiles and launching comm and compute tiles concurrently. Prior approaches (Megatron-style chunked overlap, TransformerEngine) split GEMMs into N sub-GEMMs and use stream/event scheduling — which underutilizes SMs when TP scales because the smaller GEMMs don't fill the GPU. FLUX [[2025-10-09-flux-fast-software-based-communication-o]] (ByteDance + PKU) addresses this by fusing comm tiles and compute tiles into a single large kernel via CUTLASS, with in-kernel scheduling rather than stream scheduling. The result: up to 96% comm overlap, 1.24× training throughput over Megatron-LM, and 1.66× prefill / 1.30× decoding throughput over vLLM at 8-GPU TP. The generalizable principle: fuse comm primitives into compute kernels rather than scheduling them as independent kernel launches.

In **MoE architectures**, TP interacts with Expert Parallelism (EP) in ways that expose a second class of inefficiency. Classical frameworks forced EP to be a sub-group of DP, capping EP degree at ≤ DP. [[2025-10-28-moeparallel-folding-heterogeneous-parall]] (MoE Parallel Folding, NVIDIA / Megatron-Core) shows that attention layers and MoE layers have fundamentally different optimal parallelism regimes: attention is whole-sequence dense and prefers TP + Context Parallelism (CP), while MoE is per-token sparse and prefers EP (cheaper per-token comm than Expert-TP). The paper decouples the two, giving attention its own `TP × CP × DP × PP` group and MoE its own `TP × EP × DP × PP` group with only PP forced to match. Result: 49.3% MFU on Mixtral 8×22B and 39.0% MFU on Qwen2-57B-A14B at 1,024 H100 GPUs, shipped in production Megatron-Core.

A notable counter-pattern: DeepSeek's FlashMLA decoding stack deliberately avoids TP for its decode instances, keeping `h_q = 128` so the MLA kernel stays compute-bound rather than memory-bound [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]. On H800 SXM5, the compute-memory crossover is ~258 (throttled peak ~865 TFLOPS / 3.35 TB/s); MLA decoding is compute-bound when `h_q · s_q ≥ 128`, which DeepSeek's TP=1 inference satisfies. This illustrates that TP is not always the right axis to scale decode — skipping TP preserves the compute-bound regime and avoids collective overhead entirely.

**Where sources agree**: TP communication is the primary bottleneck as TP degree increases; overlap (kernel-fusion-based or otherwise) is mandatory for TP to scale efficiently; and for MoE, EP is significantly more comm-efficient than sharding experts via TP.

**Where sources are thin**: the three sources cover training-time overlap (FLUX), MoE-specific parallelism decoupling (Parallel Folding), and a counter-TP decode case (FlashMLA). Optimal TP degree selection heuristics for dense-model inference across different hardware interconnect topologies (NVLink vs. PCIe vs. InfiniBand), and TP interaction with speculative decoding or chunked prefill pipelines, are not addressed.

## Comparison

| Axis | Megatron-LM (non-overlap baseline) | TransformerEngine (stream-overlap) | FLUX kernel-fusion overlap | MoE Parallel Folding (decoupled TP+EP) | DeepSeek TP=1 (no TP for decode) |
|---|---|---|---|---|---|
| **Overlap mechanism** | None — AllGather/ReduceScatter serialized | Stream/event scheduling; N sub-GEMMs | Tile-level comm+compute fused into single CUTLASS kernel; in-kernel scheduling | N/A (parallelism-mapping change, not overlap method) | N/A (TP avoided entirely) |
| **Training throughput** | 1.0× (baseline) [[2025-10-09-flux-fast-software-based-communication-o]] | ~0.9× (can be worse than non-overlap at small `m`) [[2025-10-09-flux-fast-software-based-communication-o]] | **1.24×** over Megatron-LM baseline (128 GPUs, 2DP×8PP×8TP) [[2025-10-09-flux-fast-software-based-communication-o]] | 49.3% MFU on Mixtral 8×22B; 39.0% on Qwen2-57B-A14B (1,024 H100) [[2025-10-28-moeparallel-folding-heterogeneous-parall]] | N/A (inference-only) |
| **Prefill throughput** | 1.0× (vLLM baseline) [[2025-10-09-flux-fast-software-based-communication-o]] | 1/2.06× of FLUX [[2025-10-09-flux-fast-software-based-communication-o]] | **1.66×** over vLLM; **2.06×** over TransformerEngine (8 GPUs, 8TP) [[2025-10-09-flux-fast-software-based-communication-o]] | ? | N/A |
| **Decode throughput** | 1.0× (vLLM baseline) [[2025-10-09-flux-fast-software-based-communication-o]] | 1/2.10× of FLUX [[2025-10-09-flux-fast-software-based-communication-o]] | **1.30×** over vLLM; **2.10×** over TransformerEngine (8 GPUs, 8TP) [[2025-10-09-flux-fast-software-based-communication-o]] | ? | Up to **80% Tensor Core utilization** on H800; ~660 TFlops [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] |
| **Comm overlap rate** | 0% [[2025-10-09-flux-fast-software-based-communication-o]] | Negative at small `m` (worse than non-overlap) [[2025-10-09-flux-fast-software-based-communication-o]] | **Up to 96%** [[2025-10-09-flux-fast-software-based-communication-o]] | N/A | N/A (no TP → no TP collectives) |
| **SM utilization** | Full (one big GEMM) | Degraded at high TP (N small GEMMs underfill SMs) [[2025-10-09-flux-fast-software-based-communication-o]] | Full (single large fused kernel) [[2025-10-09-flux-fast-software-based-communication-o]] | ? | Full (no comm split) |
| **MoE compatibility** | EP forced ≤ DP; ETP used for experts [[2025-10-28-moeparallel-folding-heterogeneous-parall]] | ? | Extends to AllToAll (MoE EP); not the headline use case [[2025-10-09-flux-fast-software-based-communication-o]] | **Decouples attention TP×CP×DP×PP from MoE TP×EP×DP×PP**; removes EP≤DP ceiling [[2025-10-28-moeparallel-folding-heterogeneous-parall]] | N/A |
| **Hardware / interconnect** | A100/H800, PCIe + NVLink [[2025-10-09-flux-fast-software-based-communication-o]] | A100/H800 [[2025-10-09-flux-fast-software-based-communication-o]] | A100/H800, PCIe + NVLink; auto-tuned per hardware [[2025-10-09-flux-fast-software-based-communication-o]] | H100, NVLink intra-node preferred [[2025-10-28-moeparallel-folding-heterogeneous-parall]] | H800 SXM5 [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] |
| **Production status** | Megatron-LM upstream [[2025-10-09-flux-fast-software-based-communication-o]] | TransformerEngine (NVIDIA) [[2025-10-09-flux-fast-software-based-communication-o]] | ByteDance production; open-source [[2025-10-09-flux-fast-software-based-communication-o]] | **Shipped in Megatron-Core** (NVIDIA/Megatron-LM) [[2025-10-28-moeparallel-folding-heterogeneous-parall]] | DeepSeek-V3 / R1 inference [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] |

## Observations

- [[Megatron-LM]]'s MLP TP partitioning: FC1 is column-parallel (shards output, no AllReduce, output sharded at [B,S,FFN/TP]) and FC2 is row-parallel (shards input, AllReduce to sum partials). At TP=4 on GPT-3 (H=12288, FFN=49152): per-GPU MLP params drop from 1.2B to 302M (4×), memory from 2.4 GB to 604 MB FP16. Attention uses column-parallel QKV + row-parallel output projection; GQA shard-counts differ for query heads vs KV heads. — [[2026-01-21-deepwiki-megatron-lm-13-feedforward-netw]]
- [[Megatron-LM]] TP full reference: `ColumnParallelLinear` + `RowParallelLinear` from `megatron/core/tensor_parallel/layers.py`; column→row chaining eliminates inter-layer comm; 3 AllReduces per layer total. Sequence Parallelism (SP) via `gather_from_sequence_parallel_region` (AllGather) + `reduce_scatter_to_sequence_parallel_region` (ReduceScatter) saves ~30% activation memory at TP=8. Llama-3 70B at TP=4 example: 17.5B params/GPU (35 GB FP16), 210 GB optimizer state before ZeRO sharding. TP must stay within NVLink domain: NVLink 400 GB/s vs. IB 25 GB/s = 16× gap, making TP=16 cross-node ~40% efficient. — [[2026-01-28-deepwiki-megatron-lm-05-tensor-paralleli]]

## Open threads

## Sources drawn on

- (auto-populated by reindex)
