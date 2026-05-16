---
created: 2026-05-12
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 18
---

# Communication-Computation Overlap

## What

Techniques for hiding distributed communication behind dependent computation — fused kernels, async pipelines, fine-grained tiling.

<!-- merged from `Communication Overlap` on 2026-05-12 -->

*Stub topic — to be expanded from sources.*

## Current understanding

The core problem is that **tensor parallelism (TP)** — the only practical path to sub-single-GPU per-token latency once a model exceeds a GPU's memory or compute ceiling — imposes a per-layer **AllGather + ReduceScatter** round-trip that constitutes a large fraction of total runtime. [[2025-10-09-flux-fast-software-based-communication-o]] (Fig 1) measures this empirically across 128-GPU A100/H800 training clusters (2DP × 8PP × 8TP) and 8-GPU inference clusters: the non-overlapped communication fraction is large enough that hiding it is the primary efficiency lever for TP-heavy deployments. The production-side signal is consistent: [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] notes that "communication implementation for >4 GPUs is suboptimal" and that the team is actively improving it — confirming current throughput numbers are not the ceiling.

**Why naïve overlap methods fail on GPUs.** The pre-Flux approach — used in Megatron-LM's chunked overlap and NVIDIA's TransformerEngine — splits one large GEMM into N smaller GEMMs (one per TP device) and uses CUDA stream/event scheduling to interleave them with communication. Three compounding failure modes emerge on GPUs (not TPUs, where the original technique was designed): (1) stream/event timing is not precisely controllable under production load with many concurrent kernels; (2) ReduceScatter overlap requires extra add operations that create a data dependence blocking concurrent execution via stream multiplexing; (3) splitting into N small GEMMs starves SMs — there is not enough work per kernel to keep the GPU utilized, and the underutilization worsens as TP degree increases. [[2025-10-09-flux-fast-software-based-communication-o]] (Fig 4) shows the failure mode concretely: TransformerEngine is *slower* than the non-overlap PyTorch baseline at small matrix dimensions, giving *negative* overlap efficiency (E_overlap < 0%).

**Flux's answer: fuse, don't split.** Instead of decomposing comm and compute across kernel boundaries, Flux over-decomposes both into fine-grained tiles — finer than per-device chunks — and fuses every (compute-tile, comm-tile) pair into a single large kernel built on [[CUTLASS]]. Each pair maps to one thread block. This achieves: (a) full SM utilization — one big kernel keeps SMs busy throughout; (b) in-kernel scheduling — timing controlled by the kernel itself, eliminating stream/event races; (c) no artificial data-dependence stalls — fusion sees through the add-op deps that blocked chunked overlap. Additional micro-optimizations — tile coordinate swizzling, GPU instruction selection, communication order selection — are auto-tuned per hardware generation and interconnect (PCIe / NVLink). The result: **up to 96% of communication can be overlapped** with dependent computation [[2025-10-09-flux-fast-software-based-communication-o]].

**Measured gains.** On AllGather + ReduceScatter (the two patterns from sharded-activation Megatron TP): **1.24× training speedup** over Megatron-LM at 128 GPUs; **1.66× prefill / 1.30× decoding** speedup over vLLM at 8-GPU TP; 2.06× / 2.10× over TransformerEngine specifically [[2025-10-09-flux-fast-software-based-communication-o]]. The Flux scope covers AllGather, ReduceScatter, and AlltoAll (the last relevant for MoE expert parallelism), but not weight-AllGather — already prefetch-overlappable and thus not the bottleneck.

**Production embedding.** [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] references **PDL (Pipelined Dispatch and Launch)**, enabled via `TRTLLM_ENABLE_PDL=1`, as a low-latency config knob for B200/GB200 deployments in TensorRT-LLM. This is a production-side signal that related communication-pipelining primitives are already embedded in the shipping stack for Blackwell hardware, distinct from but directionally consistent with Flux's kernel-fusion approach.

**Load-bearing primitives.** Three concepts anchor every technique in this topic: (1) **tile-level decomposition** — the granularity at which comm and compute interleave; coarser than a tile loses overlap opportunity, finer creates synchronization overhead; (2) **kernel fusion** — the mechanism that collapses the multi-kernel pipeline into a single scheduler-visible unit, eliminating stream/event timing races; (3) **SM utilization as the primary constraint** — splitting workloads enables overlap only if each sub-unit has enough work to keep SMs busy. The **Effective Communication Time (ECT)** metric from [[2025-10-09-flux-fast-software-based-communication-o]] (`ECT = OverallTime − best_non-split_GEMM_time`; `E_overlap = 1 − ECT_overlap / ECT_non-overlap`) provides a vendor-neutral comparison baseline: E_overlap = 100% means zero residual comm latency; negative values (observed for TransformerEngine at small `m`) mean the method is worse than no overlap at all.

**Where sources agree and where coverage is thin.** Both sources agree that (a) communication is a first-class bottleneck in TP-parallel workloads and (b) the solution direction is tighter coupling between comm and compute rather than coarser pipeline staging. Coverage is thin on: AlltoAll overlap for large-scale MoE beyond Flux's proof-of-concept mention; weight-AllGather overlap (both sources treat prefetch as already solving this); and disaggregated-prefill settings where the communication topology changes. The PDL primitive in TensorRT-LLM is mentioned without architectural detail, so its exact mechanism relative to Flux's kernel-fusion is not currently citeable.

## Comparison

| Axis | No-overlap baseline (NCCL / PyTorch) | Chunked / stream-based (Megatron-LM, TransformerEngine) | Flux (tile-level kernel fusion) |
|---|---|---|---|
| **Decomposition granularity** | None — single large GEMM + blocking comm | Per-device chunks (N GEMMs, one per TP rank) [[2025-10-09-flux-fast-software-based-communication-o]] | Fine-grained tiles, smaller than per-device chunks [[2025-10-09-flux-fast-software-based-communication-o]] |
| **Scheduling mechanism** | Sequential CUDA streams | CUDA stream/event interleaving — not precisely controllable under production load [[2025-10-09-flux-fast-software-based-communication-o]] | In-kernel scheduling via single fused CUTLASS kernel [[2025-10-09-flux-fast-software-based-communication-o]] |
| **SM utilization** | Full (one large GEMM) | Degraded — N small GEMMs starve SMs; worsens as TP degree increases [[2025-10-09-flux-fast-software-based-communication-o]] | Full — one large fused kernel keeps SMs busy throughout [[2025-10-09-flux-fast-software-based-communication-o]] |
| **ReduceScatter data-dependence stall** | N/A (sequential) | Yes — extra add ops between GEMMs create blocking dep [[2025-10-09-flux-fast-software-based-communication-o]] | No — kernel fusion sees through the dependency [[2025-10-09-flux-fast-software-based-communication-o]] |
| **E_overlap (comm overlap efficiency)** | 0% by definition [[2025-10-09-flux-fast-software-based-communication-o]] | Negative at small `m` (worse than baseline); sublinear at large `m` [[2025-10-09-flux-fast-software-based-communication-o]] | Up to 96% [[2025-10-09-flux-fast-software-based-communication-o]] |
| **Training speedup vs. Megatron-LM (128 GPU, 2DP×8PP×8TP)** | 1.00× (reference baseline) | ~0.72× vs. Flux (TransformerEngine 1.38× slower than Flux) [[2025-10-09-flux-fast-software-based-communication-o]] | 1.24× over Megatron-LM; 1.38× over TransformerEngine [[2025-10-09-flux-fast-software-based-communication-o]] |
| **Inference prefill speedup vs. vLLM (8 GPU, 8TP)** | 1.00× (vLLM baseline) | ~0.49× vs. Flux (TransformerEngine 2.06× slower than Flux) [[2025-10-09-flux-fast-software-based-communication-o]] | 1.66× over vLLM; 2.06× over TransformerEngine [[2025-10-09-flux-fast-software-based-communication-o]] |
| **Inference decoding speedup vs. vLLM (8 GPU, 8TP)** | 1.00× (vLLM baseline) | ~0.48× vs. Flux (TransformerEngine 2.10× slower than Flux) [[2025-10-09-flux-fast-software-based-communication-o]] | 1.30× over vLLM; 2.10× over TransformerEngine [[2025-10-09-flux-fast-software-based-communication-o]] |
| **AlltoAll / MoE support** | Yes (NCCL AlltoAll) | ? | Proof-of-concept; not headline use case [[2025-10-09-flux-fast-software-based-communication-o]] |
| **Hardware auto-tuning** | N/A | N/A | Yes — tile size + execution order tuned per GPU gen (A100/H800) and interconnect (PCIe/NVLink) [[2025-10-09-flux-fast-software-based-communication-o]] |
| **Production deployment signal** | vLLM default path | TransformerEngine (NVIDIA shipping) | TensorRT-LLM PDL primitive for B200/GB200 (directionally related) [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] |

## Open threads

<!-- merged from `Communication Overlap` on 2026-05-12 -->

- TensorRT-LLM's gpt-oss-120b deployment guide flags 'communication implementation for >4 GPUs is suboptimal' — what's the bottleneck (NVLink saturation? collectives bandwidth?) and what's the planned fix? Likely the same gap Flux's kernel-fusion approach addresses on training. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] [[2025-10-09-flux-fast-software-based-communication-o]]
- How much Flux retuning does Blackwell require? CUTLASS-based kernel fusion has per-target-arch cost; A100/H800 was the original tuning set. — [[2025-10-09-flux-fast-software-based-communication-o]]
- Does Flux's fused-kernel approach degrade gracefully at lower-bandwidth interconnects (cross-node TP via Infiniband), or is it only viable intra-node on NVLink? — [[2025-10-09-flux-fast-software-based-communication-o]]

## Observations

- Megatron Interleaved 1F1B 可 overlap 的两个设计条件：(1) 循环中 send_forward_recv_forward 与 Backward 无依赖；(2) 发起通信时对端已准备好数据。计算负载不均衡（最后 Stage 额外 Logit/Loss 计算）破坏条件 2，实验（PP=4, VP=2, 4×A100）可测到周期性通信延迟。相比之下，Native 1F1B 因 send_backward_recv_forward 直接用于下一步计算而无法 overlap。 — [[2025-08-25-megatron-interleaved-1f1b流水线并行中的计算负载不均衡问]]
- [[DeepEP]] 低时延 Kernel 通过 Receiving Hook 接口实现两个 Micro-Batch 的 Overlap：一个 Micro-Batch 的 RDMA 传输在另一个 Micro-Batch 的 Attention+MoE 计算期间异步执行，不占用任何计算 SM；Overlap 阶段可根据 Attention/Dispatch/MoE/Combine 实际执行时间灵活配置分界点。 — [[2025-10-09-deepseek-开源系列之-deepep-介绍]]

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

<!-- merged from `Communication Overlap` on 2026-05-12 -->

- (auto-populated by reindex)

## Observations

- NCCL symmetric memory (NCCL 2.27) is the foundational primitive for low-latency intra-node collective kernels: by mapping shared VA layouts across all local ranks, custom GPU kernels can implement AllGather/AllReduce entirely within the kernel without separate NCCL host API calls, enabling tighter comm-compute overlap at the instruction level. — [[2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par]]
- Alibaba [[RTP-LLM]] MicroBatch overlap for [[DeepSeek-V3]]: Dispatch (FP8) is shorter than Combine (FP16); Combine requires more compute to hide — Shared Expert compute covers Combine in Prefill; Decode uses Attention as the Dispatch-side cover and MoE MLP as the Combine-side cover; unified communication callback interface built to support DeepEP's two modes + Vanilla All2All + other hardware. — [[2025-10-09-如何重现-deepseek-推理性能突破]]
- [[DeepEP]] low-latency kernel three-stage flow: LOW_LATENCY_SEND_PHASE (SMs active, ~10 µs) → RDMA transit (SMs idle) → LOW_LATENCY_RECV_PHASE (SMs active, ~10 µs); `recv_hook=true` splits into two independent kernel launches, releasing SM resources between phases. — [[2025-10-09-xzwazsg-zjcksvuvksvw]]
- NCCL pipeline slot mechanism: each channel buffer is divided into NCCL_STEPS=8 slots, each slot progressing independently through Compute→Wait→Transmit→Consume stages; Warp-level role assignment within each Block enables slot-level pipeline concurrency; reducing chunkSize below stepSize increases pipeline parallelism across channels, particularly benefiting cross-node high-latency paths. — [[2025-09-01-nccl揭秘-二-通信pipeline分析]]
