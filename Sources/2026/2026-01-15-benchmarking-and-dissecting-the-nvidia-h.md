---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2402.13499
tags: [hopper, nvidia, gpu, microarchitecture, benchmarking, tensor-core, fp8, dpx, tma]
---

# [2026-01-15] Benchmarking and Dissecting the Nvidia Hopper GPU Architecture

## TL;DR

HKUST + HIT paper (arXiv:2402.13499, Feb 2024 — predates Blackwell but remains the canonical Hopper dissection) — comprehensive microbenchmark study of [[Hopper]] (H100/H800) covering the **four novel features** that distinguish it from [[Ampere]]/[[Ada]]: (1) **4th-gen Tensor Cores** with FP8 support, (2) **DPX** dynamic-programming instructions, (3) **Distributed Shared Memory (DSM)** for SM-to-SM direct comms, (4) **Tensor Memory Accelerator (TMA)** async copy engine. Provides the assembly-level (PTX/SASS) characterization that the H100 whitepaper does not. Used by anyone optimizing kernels on Hopper (FlashAttention-3, FlashMLA, FLUX all build on these primitives).

## Key claims

- **Tensor Core evolution** (Table I in paper):
  - **Volta** (1st gen TC): FP16/FP32 accumulate; introduced TC concept
  - **Turing** (2nd gen): + INT8, INT4
  - **Ampere** (3rd gen): + sparsity, FP64, BF16, TF32
  - **Hopper** (4th gen): + **FP8** (both E5M2 and E4M3 variants); per-warpgroup MMA instructions (WGMMA, async)
- **FP8 Tensor Cores: ~2× FP16 throughput.** TE's `te.Linear` in FP8 mode delivers near-2× the matmul throughput of FP16 on H100 — the single most-cited optimization win on Hopper.
- **Tensor Memory Accelerator (TMA).** Hardware unit dedicated to async global↔shared memory copies. The SM can issue a TMA copy + continue computation; TMA completes the transfer in the background, signals via an mbarrier. **This is the primitive that FlashAttention-3 + FlashMLA + FLUX all build on** (cross-ref [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] § "Fine-grained TMA copy - GEMM pipelining").
- **Distributed Shared Memory (DSM).** SMs in the same thread-block cluster can directly load/store/atomic-RMW each others' shared memory. Eliminates the round-trip through global memory + cache for cross-SM communication. Enables thread-block-cluster algorithms not expressible on Ampere.
- **DPX (Dynamic Programming X) instructions.** Hardware acceleration for min/max-of-3-values and related reductions used heavily in dynamic-programming algorithms (Smith-Waterman, Floyd-Warshall, dynamic-time-warping). Less directly relevant to LLMs but enables non-NN HPC use cases.
- **Asynchronous execution unit** beyond TMA: cluster-level barriers, async-thread-block-cluster synchronization. Lets the kernel hide more memory latency behind more compute.
- **The paper's gap-fill.** NVIDIA's H100 whitepaper documents feature *existence*; this paper measures *latency, throughput, and assembly-level behavior*. Specifically: PTX `mma` vs older `wmma` API differences; cycle-counts per TC instruction; mbarrier overhead; DSM access cost vs L1/global; FP8 conversion overhead between modules; TMA copy startup cost.
- **TE FP8 limitations called out.** Transformer Engine doesn't quantize all layers to FP8 — flash-attention operators stay in FP16; some layers stay BF16. Real-world FP8 speedup is less than theoretical 2× because of these unquantized portions + data-format conversion overhead.

### Hopper feature → consumer-kernel mapping

| Hopper feature | Primitive | Used by |
|---|---|---|
| FP8 Tensor Cores (E5M2, E4M3) | `mma.sync` / WGMMA FP8 mode | Transformer Engine, [[NVFP4]] paper's FP8 baseline |
| **WGMMA (async warpgroup matmul)** | `wgmma.async.aligned` | [[FlashAttention]]-3, [[FlashMLA]] (cross-ref the "seesaw scheduling" doc) |
| **TMA (async global↔shared)** | `cp.async.bulk.tensor` | FlashAttention-3, FlashMLA, FLUX kernel fusion |
| **DSM (SM-to-SM shared mem)** | `ld.shared.cluster`, `st.shared.cluster`, `atom.shared.cluster` | New thread-block-cluster algorithms (e.g., cooperative reductions across SMs in a cluster) |
| DPX (min/max-of-3) | `vimnmx`, `vimnmx3` family | HPC DP algorithms; Smith-Waterman, etc. |
| Async barriers (mbarrier) | `barrier.cluster.arrive`, `mbarrier.try_wait.acquire.shared` | Producer/consumer kernel patterns |

## Visual observations

**Fig 1 — Hopper SM diagram** (load-bearing)

![Hopper architecture diagram — GPC, SM composition (RegFile 16384×32-bit, INT32×16, FP32×32, FP64×16, LD/ST×8, SFU, 4th-gen TC, TMA, 256 KB L1/Shared), SM-to-SM Network, L2 / HBM](../../raw/raindrop/arxiv.org/2026-01-15-benchmarking-and-dissecting-the-nvidia-h/2026-01-15-benchmarking-and-dissecting-the-nvidia-h-figures/figure-001.png)

The single highest-density visual summary of what changed from Ampere. Shows GPC → SM unit composition (RegFile 16384×32-bit, INT32×16, FP32×32, FP64×16, LD/ST×8, SFU, 4th-gen TC, TMA, 256 KB L1/Shared), SM-to-SM Network for DSM, and the L2 / HBM hierarchy. Anyone optimizing a kernel on Hopper needs this picture in their head.

- **Table I — Tensor Core generation comparison** — Reproduced above; the canonical "what supports what" matrix.
- **Various perf/latency tables** through §3-§5 — assembly-level cycle counts for `mma`, TMA copies, DSM accesses, DPX instructions. Reference material; not narrative.

## Entities touched

[[NVIDIA]], [[Hopper]], [[Ampere]], [[Ada]], [[H100]], [[H800]], [[TMA]], [[WGMMA]], [[Tensor Core]], [[DPX]], [[Distributed Shared Memory]], [[Transformer Engine]], [[FlashAttention]], [[CUDA]], [[PTX]]

## Topics touched

[[GPU Microarchitecture]], [[Kernel Authoring Languages]], [[Low-Precision Training]], [[Attention Kernels]]

## Open questions

- Paper is Feb 2024; [[Blackwell]] has shipped since (B100/B200/GB200). Where do these benchmarks now fall short — Blackwell adds TMEM (tensor memory), 2nd-gen async TC instructions, FP4 mode, etc. A 2026 sequel would be valuable.
- DPX uptake outside HPC/bioinformatics: any LLM-relevant use cases? (The min/max-of-3 reduction is the right shape for some token-routing logic in MoE, but no one's published using it.)
- DSM enables cross-SM cooperation within a thread-block cluster — what kernel patterns has this unlocked that simply weren't possible on Ampere? Both FlashAttention-3 and FlashMLA use thread-block-cluster scheduling; DSM is presumably how they coordinate cluster-level state.
- FP8's real-world speedup vs theoretical 2× — paper documents the gap but doesn't quantify. What fraction of Transformer Engine's workload stays unquantized (and therefore caps the practical speedup) today?

## Raw source

[arxiv.org/abs/2402.13499](https://arxiv.org/abs/2402.13499) — full PDF preserved at `raw/raindrop/arxiv.org/2026-01-15-benchmarking-and-dissecting-the-nvidia-h/2026-01-15-benchmarking-and-dissecting-the-nvidia-h.pdf` (537 KB). Authors: Weile Luo, Ruibo Fan, Zeyu Li, Dayou Du (HKUST), Qiang Wang (HIT-Shenzhen), Xiaowen Chu (HKUST).
