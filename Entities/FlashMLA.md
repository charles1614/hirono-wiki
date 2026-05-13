---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: entity
refs: 6
tier: active
---

# FlashMLA

DeepSeek's MLA-decoding attention kernel for H100/H800; second-generation hits ~660 TFlops via "seesaw" scheduling.

## Synthesis


FlashMLA is DeepSeek's hand-tuned MLA decode-attention kernel for Hopper GPUs, designed around a structural constraint that rules out FlashAttention-3's ping-pong schedule: the 64x512 output matrix consumes half the SM's register file, allowing only one output per SM. The solution is a "seesaw" schedule that vertically splits the output into O_L and O_R across two warpgroups operating on alternating KV blocks, achieving CUDA-Core and Tensor-Core overlap without a second output buffer. The second-generation kernel reaches 660 TFlops on H800 SXM5 (up from 580), roughly 80% Tensor Core utilization at roughly 3 TB/s memory bandwidth; it extended to FP8 precision via PR #82 and has been validated in Ant Group's H20-96G production stack as the decode-attention backend alongside DeepEP and Single-Batch Overlap. FlashMLA forms part of DeepSeek's open-infra "publish-the-receipts" series alongside DualPipe and DeepEP, with PyTorch Profiler traces in the profile-data repo confirming how these kernels compose in the deployed serving stack. Its design point — optimizing the per-token-KV decode pathway — is directly challenged by DeepSeek V4's reported shift to Compression Sparse Attention and on-disk KV reuse, leaving open whether FlashMLA evolves to serve that new attention shape or yields to a different kernel family. Separately, NVIDIA's AVO system beat FlashAttention-4 by up to 10.5% on B200 via autonomous agent-driven kernel search, raising the question of whether an analogous evolution pipeline could outpace the hand-tuned seesaw schedule for MLA decode.


## Observations

- Second-generation kernel hits **660 TFlops on H800 SXM5** (up from 580 in the prior version). Achieves ~80% Tensor Core utilization vs the throttled ~865 TFlops practical peak. The seesaw schedule is the load-bearing trick: 12-step interleaving across two warpgroups operating on alternating KV blocks K0/K1 with vertically-split output O_L/O_R, plus fine-grained TMA-GEMM pipelining (9 64×64 TMA copies per 64×576 K-block) and `EVICT_FIRST` cache hints. Acknowledged inspirations: FlashAttention's online softmax, Flash-Decoding's split-K, CUTLASS tile-scheduling primitives. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **FP8 FlashMLA shipped via [PR #82](https://github.com/deepseek-ai/FlashMLA/pull/82)** — referenced as a decode-attention backend in Ant Group's H20-96G DeepSeek production stack. The relevant launch flag is `--attention-backend flashmla` paired with `--enable-deepep-moe` + `--deepep-mode low_latency_overlap` + `--enable-single-batch-overlap` (SBO) for low-batch decode. Validates the FlashMLA design as carrying through to next-gen Hopper deployments (H20-96G) and FP8 precision, not just H800 BF16. — [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]
- **Design point relativized if V4's CSA + on-disk KV path supplants per-token KV compression.** FlashMLA's kernel optimizes the per-token-KV decode pathway, which is exactly the pathway DeepSeek V4 reportedly walks away from. Open question for the corpus: does FlashMLA evolve to handle Compression Sparse Attention, gain an SSD-bandwidth-aware scheduling layer for on-disk KV reuse, or get replaced by a different kernel family entirely? The kernel's current design point assumes per-token KV is the hot loop; V4 reportedly changes that assumption. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Listed alongside DeepEP + DualPipe** as part of DeepSeek's "publish-the-receipts" open-infra series. The deepseek-ai/profile-data repo (PyTorch Profiler traces for V3/R1 training+inference) is the trace-level evidence that FlashMLA + DeepEP + DualPipe compose into the deployed serving stack. — [[2026-04-03-deepseek-ai-profile-data-analyze-computa]]
- **Comparison baseline for AVO's agent-discovered attention kernels** (NVIDIA arXiv:2603.24517, March 2026): AVO's autonomous evolution on B200 outperforms FlashAttention-4 by up to **10.5%** on MHA and **9.3%** on GQA. FlashMLA is the comparable design point in the FlashAttention lineage; AVO's result raises the question whether an analogous agent-evolution pipeline could find better MLA decode kernels than the hand-tuned FlashMLA seesaw schedule. — [[2026-03-31-avo框架实现gpu内核性能优化-小红书]]
