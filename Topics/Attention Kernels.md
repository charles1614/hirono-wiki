---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 9
---

# Attention Kernels

## What

GPU kernels implementing the attention operator at production-grade efficiency — FlashAttention, FlashAttention-3, FlashMLA, the Hopper Tensor Memory Accelerator path, and the kernel-level consequences of attention-variant choices (MHA vs GQA vs MLA). The substrate that determines whether a serving system can hit headline tokens-per-second numbers. 2025-2026 has been kernel-design-by-architecture-constraint: each new GPU generation reshapes which scheduling patterns are viable.

## Current understanding

**Kernel design is forced by hardware constraints, not the other way around.** The clearest demonstration is FlashMLA's departure from FlashAttention-3's ping-pong schedule [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]: FA-3 interleaves two output matrices between warpgroups to overlap CUDA-Core and Tensor-Core work on Hopper. MLA's 64×512 output matrix consumes 32,768 registers — half the SM's 65,536-register file — making a second concurrent output physically impossible. The solution is a novel **"seesaw" schedule**: vertically split the output into O_L / O_R (each 64×256), two warpgroups alternate over K blocks, and CUDA-Core/Tensor-Core overlap is achieved with only one output matrix. The algorithm is mathematically equivalent to FlashAttention's online softmax; the scheduling innovation is entirely architecture-driven. This generalizes: before reaching for FA-3's scheduling primitives in any WGMMA-based kernel, audit register budget — the pattern doesn't transfer when output size consumes a large fraction of the register file.

**MLA decoding is compute-bound on H800, not memory-bound — a counterintuitive result for an attention kernel.** Because DeepSeek doesn't tensor-parallel the decode instances, `h_q = 128`, putting the compute-memory ratio (`≈ 2 · h_q · s_q`) above H800's throttled crossover of ~258 [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]. The optimization target is therefore Tensor Core utilization, not HBM bandwidth. The new kernel reaches ~80% Tensor Core utilization and 660 TFlops on H800 SXM5. This also implies that teams that *do* use tensor parallelism for decoding (reducing `h_q` per device) may land in the memory-bound regime, shifting the bottleneck and making a different kernel schedule preferable.

**Transformer Engine's FP8 path has practical limits that attention-kernel authors must know.** The HKUST microbenchmark study [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] finds that `DotProductAttention` in TE uses FlashAttention, not FP8 Tensor Cores — so attention receives no FP8 benefit in the standard TE path. Softmax and GeLU also remain in BF16. The headline ~2× FP8-vs-FP16 speedup only materializes on linear-dominated workloads; attention is not one of them. For kernel authors: the path to FP8 attention gains requires bypassing TE's `DotProductAttention` and implementing FP8 MMA directly.

**Hopper's three novel primitives (TMA, DSM, DPX) are the load-bearing sources of its performance advantage over Ampere — not raw clock or IPC** [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]. For attention kernels, **TMA** (asynchronous block-level copies between global and shared memory) is the directly relevant primitive: it enables compute-copy overlap without thread occupation. FlashMLA exploits fine-grained TMA-GEMM pipelining, splitting each 64×576 K-block into nine 64×64 TMA copies so GEMMs begin as soon as the first copy lands. DSM (SM-to-SM communication) is not directly exploited by current attention kernels but is available for future cooperative-CTA designs.

**MLA introduces cross-stack overhead that the kernel level alone doesn't resolve.** [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] flags that prefill chunking with MLA causes redundant down/up-projection of multi-latent attention per chunk, because each chunk must re-project from the compressed latent representation. The mitigation — caching up-projected KV from earlier chunks across the prefill sequence — is noted in the NVIDIA paper but its adoption status in OSS serving stacks (FlashMLA being the obvious candidate) is an open thread. This overhead also makes piggybacked co-located serving (context-chunked prefill + decode) "highly sensitive to attention mechanism" — MLA's chunking cost shifts the disaggregation Pareto frontier relative to GQA.

**The lineage of current attention kernels is algorithmic recombination, not first-principles redesign.** FlashMLA explicitly credits FlashAttention (online softmax + accumulation), Flash-Decoding (split-K for long-context decode), and CUTLASS (tile-scheduling primitives). FA-3's ping-pong itself builds on warpgroup-level WGMMA abstractions introduced with Hopper. The pattern across 2025–2026 is: a new GPU generation (Hopper → Blackwell) or a new attention variant (MHA → GQA → MLA) creates a register or bandwidth constraint that makes the previous scheduling pattern suboptimal, and the kernel response is to recombine existing algorithmic primitives — online softmax, split-K, async copy pipelines — under the new constraint, not to invent fundamentally new algorithms.

## Open threads

- TE limitations as of the Feb-2024 HKUST paper (Softmax / GeLU not FP8-quantized, DotProductAttention bypasses FP8 TC) — do they still hold in 2025/2026 TransformerEngine versions? FP8 LLM stacks have matured substantially since. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- Why does DeepSeek not TP decode? FlashMLA asserts this as fact without justification; decode-side TP is a common KV-bandwidth optimization. There's an architectural / serving-economics reason worth understanding. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- FlashMLA's seesaw schedule is designed for 2 warpgroups + Hopper register budget. Does it generalize to 4 warpgroups on Blackwell (larger register file + different WGMMA shape)? — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- MLA piggyback overhead mitigation (cache up-projected KV from earlier chunks, per the NVIDIA Beyond-the-Buzz paper) — is this in any OSS serving stack yet? FlashMLA is the obvious candidate. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]

## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — surfaces the MLA piggyback overhead in disagg-prefill chunking; relevant for the kernel-stack interaction.
- [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] — HKUST Hopper microbenchmark; canonical FP8 / TE-limit reference and TMA/DSM/DPX instruction-level numbers.
- [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] — FlashMLA seesaw schedule deep-dive; the load-bearing kernel-design case study for MLA on H800.

