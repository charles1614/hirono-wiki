---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 6
tier: active
---

# FlashMLA

DeepSeek's MLA-decoding attention kernel for H100/H800; second-generation hits ~660 TFlops via "seesaw" scheduling.

## Synthesis

DeepSeek's MLA-decoding attention kernel for Hopper. **The seesaw-schedule deep-dive** is the canonical writeup: MLA decoding is compute-bound on H800 (because DeepSeek doesn't TP decode → `h_q × s_q ≥ 128`), so the kernel can't use FlashAttention-3's ping-pong with two output buffers — the 64×512 output matrix consumes 32,768 of an SM's 65,536 registers. Solution: vertical-split the output (O_L / O_R) and rotate between two warpgroups on alternating KV blocks (the "seesaw"). Reaches ~80% Tensor Core utilization, 3 TB/s memory bandwidth, 660 TFlops on H800 SXM5 (up from 580 in the prior version).

## Observations

- Second-generation kernel hits **660 TFlops on H800 SXM5** (up from 580 in the prior version). Achieves ~80% Tensor Core utilization vs the throttled ~865 TFlops practical peak. The seesaw schedule is the load-bearing trick: 12-step interleaving across two warpgroups operating on alternating KV blocks K0/K1 with vertically-split output O_L/O_R, plus fine-grained TMA-GEMM pipelining (9 64×64 TMA copies per 64×576 K-block) and `EVICT_FIRST` cache hints. Acknowledged inspirations: FlashAttention's online softmax, Flash-Decoding's split-K, CUTLASS tile-scheduling primitives. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **FP8 FlashMLA shipped via [PR #82](https://github.com/deepseek-ai/FlashMLA/pull/82)** — referenced as a decode-attention backend in Ant Group's H20-96G DeepSeek production stack. The relevant launch flag is `--attention-backend flashmla` paired with `--enable-deepep-moe` + `--deepep-mode low_latency_overlap` + `--enable-single-batch-overlap` (SBO) for low-batch decode. Validates the FlashMLA design as carrying through to next-gen Hopper deployments (H20-96G) and FP8 precision, not just H800 BF16. — [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]
- **Design point relativized if V4's CSA + on-disk KV path supplants per-token KV compression.** FlashMLA's kernel optimizes the per-token-KV decode pathway, which is exactly the pathway DeepSeek V4 reportedly walks away from. Open question for the corpus: does FlashMLA evolve to handle Compression Sparse Attention, gain an SSD-bandwidth-aware scheduling layer for on-disk KV reuse, or get replaced by a different kernel family entirely? The kernel's current design point assumes per-token KV is the hot loop; V4 reportedly changes that assumption. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Listed alongside DeepEP + DualPipe** as part of DeepSeek's "publish-the-receipts" open-infra series. The deepseek-ai/profile-data repo (PyTorch Profiler traces for V3/R1 training+inference) is the trace-level evidence that FlashMLA + DeepEP + DualPipe compose into the deployed serving stack. — [[2026-04-03-deepseek-ai-profile-data-analyze-computa]]
