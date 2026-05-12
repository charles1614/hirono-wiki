---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 3
---

# Attention Kernels

## What

GPU kernels implementing the attention operator at production-grade efficiency — FlashAttention, FlashAttention-3, FlashMLA, the Hopper Tensor Memory Accelerator path, and the kernel-level consequences of attention-variant choices (MHA vs GQA vs MLA). The substrate that determines whether a serving system can hit headline tokens-per-second numbers. 2025-2026 has been kernel-design-by-architecture-constraint: each new GPU generation reshapes which scheduling patterns are viable.

## Current understanding

**Kernel design is forced by hardware constraints, not the other way around.** Three concrete cases in the corpus:

- **FlashAttention-3's ping-pong** (the predecessor design) interleaves two output matrices between warpgroups for CUDA-Core/Tensor-Core overlap on Hopper. It works for standard attention shapes where the output matrix fits comfortably alongside its sibling.
- **FlashMLA's "seesaw"** ([[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]) is forced because MLA's 64×512 output matrix consumes 32,768 of the SM's 65,536 registers — half the register file. **FA-3's two-buffer rotation is impossible**; only one output per SM is feasible. Solution: vertically split the output into O_L / O_R and rotate between two warpgroups on alternating KV blocks, achieving CUDA-Core / Tensor-Core overlap with a single output. Reaches ~80% Tensor Core utilization, 3 TB/s memory bandwidth, 660 TFlops on H800 SXM5.
- **Counter-intuitively, MLA decoding is compute-bound on H800**, not memory-bound. Because DeepSeek doesn't TP-decode (`h_q = 128`), the compute-memory ratio `≈ 2 · h_q · s_q ≥ 256` exceeds H800's throttled `865 TFLOPS / 3.35 TB/s ≈ 258` crossover. The kernel-level optimization target is therefore Tensor-Core utilization, not bandwidth.

**Transformer Engine's FP8 path has practical limits** ([[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] HKUST microbench): **`DotProductAttention` bypasses FP8 Tensor Cores for FlashAttention**, so attention doesn't actually benefit from FP8 in the standard TE path. Softmax and GeLU also stay BF16. The headline 2× FP8-vs-FP16 speedup is achievable only on linear-dominated workloads.

**MLA-specific cross-stack overhead** that the kernel doesn't address: [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] flags that prefill chunking causes redundant down/up-projection of multi-latent attention per chunk. Mitigation: cache up-projected KV values from earlier chunks. **Open thread**: is this in any OSS serving stack yet? FlashMLA is the obvious candidate.

**Inspirations + lineage**: FlashMLA explicitly credits FlashAttention (online softmax + accumulation), Flash-Decoding (split-K), and CUTLASS (tile-scheduling primitives). The pattern is **algorithmic recombination + architectural-constraint-driven scheduling**, not first-principles redesign.

## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — surfaces the MLA piggyback overhead in disagg-prefill chunking; relevant for the kernel-stack interaction.
- [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] — HKUST Hopper microbenchmark; canonical FP8 / TE-limit reference and TMA/DSM/DPX instruction-level numbers.
- [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] — FlashMLA seesaw schedule deep-dive; the load-bearing kernel-design case study for MLA on H800.

## Open threads

- (to be filled in)
- TE limitations as of the Feb-2024 HKUST paper (Softmax / GeLU not FP8-quantized, DotProductAttention bypasses FP8 TC) — do they still hold in 2025/2026 TransformerEngine versions? FP8 LLM stacks have matured substantially since. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- Why does DeepSeek not TP decode? FlashMLA asserts this as fact without justification; decode-side TP is a common KV-bandwidth optimization. There's an architectural / serving-economics reason worth understanding. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- FlashMLA's seesaw schedule is designed for 2 warpgroups + Hopper register budget. Does it generalize to 4 warpgroups on Blackwell (larger register file + different WGMMA shape)? — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- MLA piggyback overhead mitigation (cache up-projected KV from earlier chunks, per the NVIDIA Beyond-the-Buzz paper) — is this in any OSS serving stack yet? FlashMLA is the obvious candidate. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]


## Sources drawn on

- (auto-populated by reindex)
