---
created: 2026-05-12
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 12
---

# MoE Training

## What

Training mixtures of experts at scale — gating, routing, load balancing, drop vs dropless, hybrid parallelism.

## Current understanding

**Mixture-of-Experts (MoE)** training replaces a dense feed-forward network with a bank of expert sub-networks, activating only a sparse subset (typically top-1 or top-2) per token via a learned **gating / router** network. The core training challenge is that the router is discrete — argmax over experts is not differentiable — so in practice a soft-max over router logits is used during the forward pass, and the actual routing decision is treated as a hard selection with gradients flowing through the chosen experts' outputs.

**Load balancing** is the central stability problem. Without explicit pressure, the router collapses: a small number of experts receive almost all tokens (**routing collapse**), while the rest go untrained. The standard fix is an **auxiliary load-balancing loss** (a differentiable proxy for token-fraction-per-expert uniformity) added to the main training objective with a tunable coefficient. The tension is that stronger balance coefficients hurt quality by overriding the router's learned specialization; practitioners treat this coefficient as a critical hyperparameter.

Two distinct regimes exist for handling **expert capacity** (the maximum tokens an expert processes per batch): **drop** routing discards tokens that overflow an expert's capacity buffer — simple, predictable memory footprint, but introduces gradient noise for dropped tokens; **dropless** routing (e.g. as in ST-MoE, GLaM follow-ons) avoids dropping but requires dynamic buffer sizing or sequence-level redistribution, which complicates batching. The dropless path is generally preferred for quality but adds engineering complexity.

**Hybrid parallelism** is unavoidable at scale. MoE models are wide (many experts) but each expert is small, so naive tensor parallelism is inefficient. The standard decomposition is **expert parallelism** (EP) — each device hosts a subset of experts — combined with data parallelism over the non-MoE layers and, for very large experts, tensor parallelism within each expert. The **all-to-all collective** for dispatching tokens to the correct expert device (and gathering results back) becomes the communication bottleneck; its cost scales with the number of expert-parallel ranks and the token count, not with model depth.

**Routing strategies** vary along two axes — *who is routed* and *how many experts*. Token-choice routing (each token picks its top-k experts) is the dominant design; expert-choice routing (each expert picks its top-k tokens) guarantees perfect load balance but breaks autoregressive generation. Auxiliary-loss-free alternatives (e.g. bias-based routing adjustments as in DeepSeek-V3) attempt to achieve balance without the loss term, trading the coefficient tuning problem for a heuristic update rule. Fine-grained MoE (many small experts, higher k) offers smoother load distribution at the cost of more all-to-all traffic.

**Key open questions** in the field concern how expert specialization actually emerges (token frequency vs semantic clustering), whether router collapse can be fully prevented without auxiliary loss, optimal EP rank count for a given cluster topology, and how MoE training stability interacts with low-precision (FP8/INT8) training regimes.

**Sparse activation as an architectural principle, not just an efficiency trick.** The [[Pathways]] announcement (2021) reframes sparse MoE routing as the mechanism for *generalization* — each task activates a different subnetwork, and the model learns to route tasks through whichever sub-circuits are most relevant. [[GShard]] and [[Switch Transformer]] are cited as efficiency evidence (sub-1/10th energy vs equivalent-capacity dense models), but the broader claim is that sparsity enables a single model to acquire specializations that can be dynamically composed for novel tasks [[2026-01-12-introducing-pathways-a-next-generation-a]]. This framing connects to the load-balancing and routing-collapse challenges above: if sparse routing is genuinely where specialization lives, then routing collapse isn't just an efficiency failure — it's a quality failure.

## Open threads

## Observations

- 百度混合云在 MoE 训练中通过 batch-level 动态冗余专家编排将专家均衡度优化至 1.08，并最大化计算通信 overlap，使整体吞吐提升 20% 以上；同时优化 Alltoall 算子，相比开源方案大幅提升 Prefill 和 Decode 阶段 Alltoall 通信性能。 — [[2025-09-16-超大规模-ai-基础设施建设实践-极致释放算力效能]]
- Alibaba Cloud PAI paiMoE engine targets large-scale MoE training: Tangram (supports diverse fine-grained MoE training tasks via a single scheduling mechanism) + ChunkFlow (chunk-centric mechanism for variable-length and ultra-long sequences; ICML 2025) are deployed as default mechanisms for [[Qwen]] series CPT/SFT stages, achieving 3× end-to-end speedup and MFU >61% on Qwen3 training. — [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]]
- [[DeepEP]] 高吞吐 Kernel 在 H800（8×H800，2048 卡集群）训练/Prefill 场景下，以 FP8 Dispatch + BF16 Combine 将节点间通信量减半，测试配置：4096 Token/Batch、隐藏层 7168、Top-4 组 Top-8 专家，带宽接近物理极限；通过 IB VL/SL 流量隔离防止高吞吐/低时延 workload 相互干扰。 — [[2025-10-09-deepseek-开源系列之-deepep-介绍]]

## Sources drawn on

- [[2026-03-04-qwen3-5-blog]] — Qwen3.5-397B-A17B training: disaggregated async RL framework (3×–5× speedup), native FP8 pipeline (~50% activation memory, >10% throughput), Gated DeltaNet + Gated Attention hybrid MoE architecture.
- [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]] — Alibaba Cloud PAI paiMoE: Tangram + ChunkFlow as production MoE training primitives; 3× speedup and MFU >61% on Qwen3.
- [[2025-07-15-https-www-zhihu-com-question-19271405065]] — Kimi K2 architecture: sparsity scaling law motivating 384 experts at fixed activated params; EPLB + redundant experts for load balance without grouping; prefill is compute-bound at long seq; decode is memory-bound with EP=128.
