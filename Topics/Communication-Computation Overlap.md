---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 2
---

# Communication-Computation Overlap

## What

Techniques for hiding distributed communication behind dependent computation — fused kernels, async pipelines, fine-grained tiling.

<!-- merged from `Communication Overlap` on 2026-05-12 -->

*Stub topic — to be expanded from sources.*

## Current understanding

The core problem is that **tensor parallelism (TP)** — the only practical way to shrink per-token latency past a single GPU's compute or memory ceiling — imposes a per-layer AllGather/ReduceScatter that shows up as a substantial fraction of total runtime. [[2025-10-09-flux-fast-software-based-communication-o]] (Fig 1) quantifies this empirically across 128-GPU A100/H800 training clusters and 8-GPU inference clusters: the non-overlapped communication fraction is large enough to make hiding it the primary efficiency lever for TP-heavy deployments.

**Why naïve overlap methods fail on GPUs.** The pre-Flux approach — used in Megatron-LM's chunked overlap and NVIDIA's TransformerEngine — splits one large GEMM into N smaller GEMMs (one per device) and uses CUDA stream/event scheduling to interleave them with communication. This has three compounding problems on GPUs: (1) stream/event timing is not precisely controllable under production load with many concurrent kernels; (2) ReduceScatter overlap requires extra add operations that create a data dependence blocking concurrent execution; (3) splitting into N small GEMMs starves SMs — there isn't enough work per kernel to keep the GPU utilized, and the underutilization worsens as TP scale increases. [[2025-10-09-flux-fast-software-based-communication-o]] Fig 4 shows the failure mode concretely: TransformerEngine is *slower* than the non-overlap PyTorch baseline at small matrix dimensions, giving *negative* overlap efficiency.

**FLUX's answer: fuse, don't split.** Instead of decomposing comm and compute across kernel boundaries, Flux over-decomposes both into fine-grained tiles and fuses every (compute-tile, comm-tile) pair into a single large kernel built on [[CUTLASS]]. Each pair maps to one thread block, giving: full SM utilization (one big kernel keeps SMs busy throughout), in-kernel scheduling (timing controlled by the kernel, not stream/event races), and no artificial data-dependence stalls. Additional micro-optimizations — tile coordinate swizzling, GPU instruction selection, communication order selection — are auto-tuned per hardware generation. The result is that up to **96% of communication can be overlapped** with dependent computation [[2025-10-09-flux-fast-software-based-communication-o]].

**Measured gains.** On AllGather + ReduceScatter (the two patterns from sharded-activation Megatron TP): **1.24× training speedup** over Megatron-LM at 128 GPUs (2DP × 8PP × 8TP, A100/H800, PCIe and NVLink); **1.66× prefill / 1.30× decoding** speedup over vLLM at 8-GPU TP; 2.06×/2.10× over TransformerEngine specifically. The pattern also extends to AlltoAll (relevant for MoE expert parallelism), though that is not the headline use case.

**Practical deployment context.** [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] references PDL (Pipelined Dispatch and Launch, enabled via `TRTLLM_ENABLE_PDL=1`) as a low-latency config knob for B200/GB200 deployments — a production-side signal that TensorRT-LLM embeds a related communication-pipelining primitive for Blackwell hardware. The note that "communication implementation for >4 GPUs is suboptimal" in the same source confirms this remains an active area: current throughput numbers for multi-GPU TP are not the ceiling, and the team is actively improving it.

**Load-bearing primitives.** Three concepts anchor every technique in this topic: (1) **tile-level decomposition** — the granularity at which comm and compute are interleaved; coarser than a tile and you lose overlap opportunity, finer and synchronization overhead dominates; (2) **kernel fusion** — the mechanism that collapses the multi-kernel pipeline into a single scheduler-visible unit, eliminating stream/event timing races; (3) **SM utilization as the primary constraint** — splitting workloads to enable overlap is only beneficial if each sub-unit has enough work to keep SMs busy; the Flux design is, at its core, a solution to the SM starvation that chunked-overlap induces. The Effective Communication Time (ECT) metric introduced in [[2025-10-09-flux-fast-software-based-communication-o]] (`ECT = OverallTime − best_non-split_GEMM_time`) provides a vendor-neutral way to compare overlap methods; an E_overlap of 100% means zero residual comm latency.

**Where sources agree and where coverage is thin.** Both sources agree that (a) communication is a first-class bottleneck in TP-parallel workloads, and (b) the solution direction is tighter coupling between comm and compute rather than coarser pipeline staging. Coverage is currently thin on: AlltoAll overlap for large-scale MoE (beyond Flux's proof-of-concept mention); weight-AllGather overlap (both sources treat this as already handled by prefetch); and disaggregated-prefill settings where the communication topology changes (cross-pool vs within-pool). Those gaps are the natural expansion surface as more sources accumulate.

## Open threads

<!-- merged from `Communication Overlap` on 2026-05-12 -->

- TensorRT-LLM's gpt-oss-120b deployment guide flags 'communication implementation for >4 GPUs is suboptimal' — what's the bottleneck (NVLink saturation? collectives bandwidth?) and what's the planned fix? Likely the same gap Flux's kernel-fusion approach addresses on training. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] [[2025-10-09-flux-fast-software-based-communication-o]]
- How much Flux retuning does Blackwell require? CUTLASS-based kernel fusion has per-target-arch cost; A100/H800 was the original tuning set. — [[2025-10-09-flux-fast-software-based-communication-o]]
- Does Flux's fused-kernel approach degrade gracefully at lower-bandwidth interconnects (cross-node TP via Infiniband), or is it only viable intra-node on NVLink? — [[2025-10-09-flux-fast-software-based-communication-o]]

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

<!-- merged from `Communication Overlap` on 2026-05-12 -->

- (auto-populated by reindex)

