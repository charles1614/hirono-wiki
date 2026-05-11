---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2504.14960
tags: [moe, training, parallelism, megatron, nvidia, mixtral, qwen, h100]
---

# [2025-10-28] MoE Parallel Folding: Heterogeneous Parallelism Mappings for Efficient Large-Scale MoE Training with Megatron Core

## TL;DR

[[NVIDIA]] paper (arXiv:2504.14960, last rev Mar 2026) introducing **MoE Parallel Folding** — a 5-D hybrid parallelism strategy that **decouples** the parallelism mapping of attention layers from MoE layers in transformer models, so each can adopt its own optimal config. Plus an accompanying token-level dispatcher supporting all 5 parallelism dimensions (TP/EP/CP/DP/PP), token-dropping + dropless modes, dynamic shapes. Headline numbers: **49.3% MFU on Mixtral 8×22B**, **39.0% MFU on Qwen2-57B-A14B**, scales to **1,024 GPUs**, supports **128K context length**. Code: NVIDIA/Megatron-LM.

## Key claims

- **The core insight: attention and MoE layers want different parallelism mappings.** Previous "single mapping per model" approaches force a compromise. Attention is dense + sequence-bound (TP + CP fit naturally); MoE FFN is sparse + token-routed (EP fits, but EP conflicts with the TP optimal for attention). Folding decouples them.
- **5-D parallelism dimensions:**
  - **TP** — Tensor Parallelism (within-layer matmul)
  - **EP** — Expert Parallelism (route experts to GPUs)
  - **CP** — Context Parallelism (split sequence dimension)
  - **DP** — Data Parallelism (replicate model)
  - **PP** — Pipeline Parallelism (split layers across GPUs)
- **Why prior approaches struggle.** Previous methods placed the EP group as a sub-group of DP, which compromises EP's efficiency at scale. MoE Parallel Folding makes EP/TP/CP for MoE-FFN layers independent of TP/CP for attention layers.
- **Token-level dispatcher.** The hard part of decoupled parallelism is moving tokens correctly across the two different parallel topologies on each layer boundary. The paper's dispatcher handles dynamic tensor shapes, supports both token-dropping (some tokens dropped if expert overfull) and token-dropless modes, and works across all 5 parallelism dimensions.
- **Headline MFU results (BF16, H100, optimal parallelism per model):**

| Model | TransformerEngine baseline | Prior best | **MCore w/ Folding** |
|---|---|---|---|
| Mixtral 8×22B | (<10% FSDP) | 46.3% | **49.3%** |
| Llama3 8×70B (MoE variant) | — | — | **41.6%** |
| Qwen2-57B-A14B | — | 35.3% | **39.0%** |
| Mixtral 8×22B-G8T8 | — | — | **28.8%** |

- **Scaling: 1,024 GPUs.** Strong-scaling experiments up to 1024 GPUs with global batch size 1024. The framework's MFU stays consistently higher than competing parallelism strategies as GPU count grows.
- **Long-context: 128K tokens.** Validated at sequence lengths up to 128K — Context Parallelism enables this in conjunction with the rest of the 5-D strategy.
- **FSDP is bad for MoE training.** Numerical baseline: FSDP on these MoE models exhibits **< 10% MFU** due to sparse computation patterns + large communication overhead. The paper makes the case for hybrid parallelism over uniform DP/FSDP.
- **Comparison setup.** All baselines tuned for their best parallelism configuration; the gain is not just "we added folding" but "we beat hand-tuned alternatives by 3–7 points of MFU."
- **Open-sourced in Megatron-Core.** Production-ready integration; the paper is documentation for an already-shipped framework feature.

## Visual observations

**Fig 1 — Parallelism mappings with MoE Parallel Folding** (load-bearing — defines the paper's central concept)

![Parallelism mappings — previous methods place EP-group as sub-group of DP (left, middle); Folding decouples attention/MoE topology (right)](../../raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall-images/page-005.png)

Visual contrast: previous methods place EP-group as sub-group of DP (left/middle) vs Folding's decoupled attention/MoE topology (right). The single most important diagram for understanding what "Folding" actually means architecturally — without it, "decoupled parallelism" is abstract.

- **Fig 2 — Token dispatcher workflow with TP + EP** — How a 4-GPU MoE layer dispatches tokens across both parallelism dimensions. See PDF for exact page. Supporting (engineering complexity context).
- **Fig 3 — Strong scaling up to 1024 GPUs** — MFU stays high as GPU count scales; competing strategies degrade. See PDF for exact page. Supporting (claim is in Key Claims).

## Entities touched

[[NVIDIA]], [[Megatron-LM]], [[Megatron-Core]], [[Mixtral]], [[Qwen]], [[Llama]], [[H100]], [[FSDP]], [[Transformer Engine]]

## Topics touched

[[MoE Serving]], [[Training Infrastructure]], [[Parallelism Strategies]], [[Inference Disaggregation]]

## Open questions

- **MoE training vs MoE inference parallelism**: this paper is training-time. [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] surfaces the MoE-backend-by-hardware matrix for *inference*. Are the folded parallelism configurations symmetric — same TP/EP layout for inference as training — or does inference want a fundamentally different mapping (probably yes — KV-cache shape changes everything)?
- 49.3% MFU on H100 is good but not best-known for dense models (~55–60%). MoE has a structural ceiling because of token-dropping + expert imbalance. What's the theoretical max MFU for sparse routing?
- The 1024-GPU strong-scaling chart's right edge — at what point does even Folding's curve start bending? The paper doesn't extrapolate, but the slope tells you the next-scale-up regime.
- **G8T8 variant of Mixtral 8×22B** at 28.8% MFU — substantially lower than vanilla 8×22B at 49.3%. What's G8T8 (group-by-8, top-8?) and why does it drag MFU down so hard?
- Cross-reference [[2025-10-09-flux-fast-software-based-communication-o]]: FLUX shows ~96% comm-overlap is achievable with kernel fusion. Folding's MFU gains may stack with FLUX's comm-overlap gains — neither paper benchmarks the combination.
- Cross-reference [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]: Folding's "different layers want different parallelism" insight is *the same insight* as Beyond-the-Buzz's "different inference phases want different mappings." Both are arguing against single-mapping-per-deployment. Convergent pattern across train + infer.

## Raw source

[arxiv.org/abs/2504.14960](https://arxiv.org/abs/2504.14960) — full PDF preserved at `raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall.pdf` (4.0 MB). Authors: NVIDIA team led by Dennis Liu, Zijie Yan; corresponding June Yang. Code in NVIDIA/Megatron-LM.
