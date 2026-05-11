---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/deepseek-ai/FlashMLA/blob/main/docs/20250422-new-kernel-deep-dive.md
tags: [kernel, deepseek, mla, attention, h800, cuda, optimization]
---

# [2026-01-28] FlashMLA — A Deep-Dive Into the New Flash MLA Kernel

## TL;DR

[[DeepSeek]] published a deep-dive on their second-generation [[FlashMLA]] kernel — the [[MLA]] decoding-attention kernel that powers DeepSeek-V3 / R1 inference. Going from 580 → 660 TFlops on H800 SXM5 (≈80% of throttled peak) by inventing **"seesaw" scheduling**: a single-output-matrix ping-pong variant that overlaps CUDA-Core and Tensor-Core ops *despite* WGMMA's register pressure preventing classic FlashAttention-3 ping-pong. The key analytical insight: MLA decoding is **compute-bound**, not memory-bound, because DeepSeek's no-tensor-parallel inference choice sets h_q = 128 (above the H800 compute-vs-memory cutoff of 128).

## Key claims

- **Roofline derivation** for MLA decode: compute-memory ratio is ~2·h_q·s_q. H800 SXM5 peak is 990 TF + 3.35 TB/s, but throttled (~1.6 GHz) → practical 865 TF → cutoff at h_q·s_q = 128. Above 128, kernel is compute-bound.
- DeepSeek's inference architecture choice — **no tensor parallel for decoding instances** — forces h_q = 128, putting MLA squarely in the compute-bound regime. So the kernel target is *compute saturation*, not bandwidth.
- WGMMA register pressure rules out FlashAttention-3-style ping-pong: a 64×512 output matrix needs 32,768 32-bit registers; an SM has only 65,536 → only one in-flight output matrix per SM, not two.
- **"Seesaw" scheduling** — DeepSeek's novel solution: split the single output matrix vertically (O_L, O_R), two warpgroups operate on the two halves with interleaved softmax + scaling, mathematically equivalent to FlashAttention's online-softmax but with one output matrix instead of two. The schedule has 12 ordered steps (listed in the doc), preserves correctness, and overlaps CUDA Core with Tensor Core.
- **Three technical sub-optimizations** layered on top: (a) fine-grained TMA copy + GEMM pipelining — split a 64×576 K block into 9 × (64×64) TMA copies so GEMM starts after each chunk lands; (b) `cute::TMA::CacheHintSm90::EVICT_FIRST` for better L2 hit rate; (c) Programmatic Dependent Launch to overlap `splitkv_mla` + `combine` kernels; (d) explicit tile scheduler for SM load balance.
- Result: **80% of throttled Tensor Core peak**, **3 TB/s memory bandwidth**, **660 TFlops** sustained. ~2% slower than previous (ping-pong-buffer) version in memory-bound regime, but accepted because the target regime is compute-bound.
- Inspirations explicitly credited: [[FlashAttention]], Flash-Decoding (CRFM Stanford 2023), [[CUTLASS]].

## Entities touched

[[DeepSeek]], [[FlashMLA]], [[MLA]], [[FlashAttention]], [[CUTLASS]], [[H800]], [[WGMMA]], [[TMA]]

## Topics touched

[[Kernel Authoring Languages]], [[Attention Kernels]], [[LLM Inference Systems]]

## Open questions

- The "no tensor parallel for decoding" choice is what makes h_q = 128 — this is DeepSeek's specific deployment architecture. For labs that *do* TP their decoding, h_q drops and the kernel falls into memory-bound regime — what does that operating point look like?
- WGMMA register pressure is an SM90 (Hopper) constraint. On Blackwell, with the new TMEM unit (per [[NVFP4]] paper), does the seesaw schedule still apply or does a simpler 2-output ping-pong return?
- 80% of *throttled* peak — what does the un-throttled (CPU-cooled / non-thermal-limited) number look like? Bench cite gives "865 TFlops practical" but doesn't quote the full-1.7 GHz number.
- DeepSeek FlashMLA + FlashAttention-3 are now diverging — both built on H100/H800 + WGMMA but solving for different register-pressure regimes. Does this fork (different schedules for MLA vs full-attention) become permanent or do they reconverge?
- How does seesaw scheduling generalize to other attention variants — GQA, MQA, MoE-attention? Or is it MLA-specific because of the 64×512 head-dim shape?

## Raw source

[github.com/deepseek-ai/FlashMLA/blob/main/docs/20250422-new-kernel-deep-dive.md](https://github.com/deepseek-ai/FlashMLA/blob/main/docs/20250422-new-kernel-deep-dive.md) — full doc, ~8 KB body with one architecture diagram.
