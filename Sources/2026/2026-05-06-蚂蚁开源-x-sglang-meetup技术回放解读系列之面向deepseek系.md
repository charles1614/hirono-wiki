---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://mp.weixin.qq.com/s/rpBazhw4i3h9VIqrH6qNTQ
tags: [inference, moe, parallelism, attention-kernels, production-deployment, gpu]
---

# [2026-05-06] 蚂蚁开源 x SGLang Meetup：面向 DeepSeek 系列模型的深度优化与实践

## TL;DR

A code-grounded recap by **GiantPandaLLM** of Ant Group's January 2026 SGLang Meetup talk on serving DeepSeek-R1/V3/V3.1/V3.2 on **H20-96G** in production. Substantive value isn't any single trick — it's a worked example of **hardware-first optimization**: H20-96G is "lopsided" (15% of H800's FP8/BF16 compute, but bigger VRAM, faster bandwidth, 2.25× NVLink, half the RDMA), so prefill and decode get separated and tuned against different bottlenecks. The post traces every slide back to its concrete [[SGLang]] / DeepEP / DeepGEMM / FlashMLA pull request, making it an unusually high-density entry point to the Ant Theta production stack.

## Key claims

**H20 forces PD disaggregation by its compute/bandwidth lopsidedness.** With H20-96G at ~15% of H800's FP8/BF16 throughput but 1.19× HBM bandwidth and 2.25× NVLink bandwidth, a single co-located mapping leaves Pareto on the table. Prefill on `TP8`, decode on `DP16 + EP16` — concrete `sglang.launch_server` invocations included for both sides. (See [[Inference Disaggregation]] for the disagg-is-not-universal framing this confirms in production form.)

**Prefill side — three concrete kernel-level wins, all upstream PRs:**

- `#10568` *TP Reduce-Scatter + RMSNorm + qkv_a*: instead of TP-AllReduce after attention then full-hidden RMSNorm + qkv projection, scatter the reduction across TP ranks and let each rank do its `1/TP`-th slice. Wallclock reduction on the prefill critical path.
- `#10953` *Chunked-prefix MHA one-shot*: under chunked prefill, MLA-decode-style attention isn't always better than MHA. Merging prefix and extend KV cache lets MHA run once over the combined sequence rather than twice (once for prefix, once for extend).
- `#10567` *FusedMoE down-proj TMA*: down projection's latency was disproportionate to its compute. Adding Hopper TMA loads pulls the bottleneck back into proportion.

**Decode side — small-batch MoE economics drive the architecture:**

- **SwapAB GEMM** ([DeepGEMM #192](https://github.com/deepseek-ai/DeepGEMM/pull/192) + [SGLang #16723](https://github.com/sgl-project/sglang/pull/16723)): in small-`m` decode regimes, swap A/B operands so the wide dimension lands on N instead of M, improving Tensor Core utilization.
- **FP8 [[FlashMLA]]** ([FlashMLA #82](https://github.com/deepseek-ai/FlashMLA/pull/82)): pushes MLA decode-kernel quantization to FP8. Cross-references the [[Attention Kernels]] seesaw schedule.
- **SBO (Single-Batch Overlap)** across SGLang/[DeepEP #390](https://github.com/deepseek-ai/DeepEP/pull/390) + [DeepGEMM #183](https://github.com/deepseek-ai/DeepGEMM/pull/183): overlap MoE dispatch/combine with GEMM at the single-batch granularity (vs Two-Batch Overlap which requires duplicating control flow).
- **TBO is rejected** for this deployment — explicit slide explaining why: TBO doubles the control-plane complexity for a marginal small-batch win when SBO already captures most of the overlap.

**Communication side — Expert Affinity EPLB + observability.** [Ant's EPLB PR](https://github.com/antgroup/sglang/pull/2) uses a real-traffic co-activation matrix (not random) to place experts so frequently-co-firing experts sit on the same node — measurably reduces cross-node RDMA (the H20 short pole). **DeepXTrace** (separate Ant repo, not in SGLang yet) is the slow-rank-finder for hierarchical dispatch debugging.

**EAGLE / NEXTN simplification (Simple Eagle).** `--speculative-algorithm NEXTN --speculative-num-steps 1 --speculative-eagle-topk 1 --speculative-num-draft-tokens 2` — minimal Eagle config that still gives meaningful TPOT improvement on small-batch decode without complicating the kernel zoo. Two follow-up PRs ([#11398](https://github.com/sgl-project/sglang/pull/11398), [#11434](https://github.com/sgl-project/sglang/pull/11434)) added spec-overlap and CUDA-graphed draft post-processing.

**DeepSeek-V3.2 DSA reopens kernel questions.** DSA (DeepSeek Sparse Attention) breaks several invariants the V3 stack assumed: prefill CP is non-trivial, the Indexer becomes a hotspot, MLA-vs-MHA selection changes per chunk. Adaptive MHA + masked-attention work is in PRs [#12065](https://github.com/sgl-project/sglang/pull/12065) and [#11892](https://github.com/sgl-project/sglang/pull/11892); decode-side TP8 vs DP16/EP16 for V3.2 is still being worked.

## Visual observations

~30 slide screenshots (`weixin-img-001.png` through `weixin-img-030.png`); the article's prose paraphrases each slide, so most are supporting (not load-bearing) for the wiki's purposes. Three load-bearing slides referenced below, each tied to a section that's a load-bearing claim above.

**0x1 — H20-96G hardware constraints** (`../../raw/raindrop/mp.weixin.qq.com/2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系/weixin-img-004.png`)

![H20-96G vs H800-80G hardware comparison table: FP8/BF16 compute ~15%, VRAM 96 vs 80 GB, HBM bandwidth 4000 vs 3352 GB/s, NVLink 900 vs 400 GB/s, RDMA half](../../raw/raindrop/mp.weixin.qq.com/2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系/weixin-img-004.png)

The "lopsided H20" comparison table — establishes the foundational constraint vector that drives every downstream optimization choice in the talk: compute-weak but bandwidth-strong + intra-node-strong + inter-node-weak, so split prefill from decode and avoid cross-node traffic where possible.

**0x7 — Expert Affinity EPLB co-activation** (`../../raw/raindrop/mp.weixin.qq.com/2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系/weixin-img-011.png`)

![EPLB co-activation matrix slide: expert-pair co-firing frequencies under real DeepSeek-R1 traffic, grouped onto nodes to minimize cross-node AlltoAll](../../raw/raindrop/mp.weixin.qq.com/2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系/weixin-img-011.png)

Real-traffic expert placement is the load-bearing methodological habit: co-activation matrices from production logs, not random init or synthetic load. Frequently-co-firing experts get placed on the same node, measurably reducing the H20's RDMA short pole.

**0xA — DeepXTrace observability** (`../../raw/raindrop/mp.weixin.qq.com/2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系/weixin-img-014.png`)

![DeepXTrace per-rank timing dashboard: identifies slow ranks in hierarchical dispatch, critical for debugging EPLB load-balance regressions](../../raw/raindrop/mp.weixin.qq.com/2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系/weixin-img-014.png)

The slow-rank-finder companion to EPLB. Without per-rank visibility you can't tell whether a load-imbalance regression came from a sticky expert, a network blip, or upstream traffic shift. DeepXTrace is a separate Ant repo (not yet in SGLang upstream).

**Supporting slides** (not inlined): launch-flag listings (sections 0x2 / 0x3), per-PR diff hunks (0x3.1–0x3.3, 0x4, 0x6), Simple Eagle config (0x9), Decode evaluation tables (0xB), and the V3.2 DSA architectural diagrams (0xC). Each is paraphrased into the matching Key claim above; image-fidelity is sufficient to verify the PR numbers + launch flags if needed.

## What this changes

Confirms [[Inference Disaggregation]]'s "disagg helps when hardware is lopsided" framing with a concrete H20 case study — and adds a procedural lesson: **start from the hardware constraint vector (compute / VRAM / NVLink / RDMA), not from the kernel zoo**. The Ant team's two methodological habits worth borrowing: (1) MoE tuning uses **real traffic** `topk_ids`, not synthetic; (2) Expert placement uses **co-activation** matrices, not random init. Both are operationally cheap if instrumentation exists.

Cross-references and updates [[MoE Serving]] with SBO-vs-TBO tradeoff data, and [[Attention Kernels]] with FP8 FlashMLA + the SwapAB tensor-core utilization pattern.

## Raw source

> 公众号: **GiantPandaLLM** (BBuf)
> 发布: 2026-05-06
> Original talk: Ant Open-source × SGLang Meetup (January 2026), Zhang Tianyu (墨纭), "面向 DeepSeek 系列模型的深度优化和实践"
> Companion LMSYS post: <https://www.lmsys.org/blog/2025-09-26-sglang-ant-group/>
> AntGroup reproducibility PR: <https://github.com/antgroup/sglang/pull/4>
