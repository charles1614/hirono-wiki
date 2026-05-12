---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://arxiv.org/pdf/2504.14960
tags: [moe, parallelism, training, paper]
---

# [2025-10-28] MoE Parallel Folding: Heterogeneous Parallelism Mappings for Efficient Large-Scale MoE Model Training

## TL;DR

NVIDIA paper (Dennis Liu et al., arXiv:2504.14960 Apr 2025, shipped in Megatron-Core) on **decoupling the parallelism mappings of attention and MoE layers** in 5-D hybrid-parallel MoE training (TP × EP × CP × DP × PP). The load-bearing insight: attention and MoE have fundamentally different compute+comm patterns (whole-sequence dense vs. per-token sparse), so forcing them through the same parallelism mapping leaves performance on the table. **MoE Parallel Folding** lets each layer type pick its own 4-D parallelism config — only PP must match. Result: **49.3% MFU on Mixtral 8x22B and 39.0% MFU on Qwen2-57B-A14B** on H100, scaling to 1,024 GPUs at 128K sequence length. Supported by a new flexible token-level dispatcher that handles both token-dropping and token-dropless training under arbitrary parallelism combinations.

## Key claims

- **Why uniform parallelism is wrong for MoE**: attention is whole-sequence dense (likes TP+CP), MoE is per-token sparse (likes EP, which is dramatically cheaper than ETP). Forcing both into the same mapping over-pays comm in one half and under-utilizes scale in the other.
- **The classical constraint MoE Parallel Folding removes**: prior frameworks put the EP group as a sub-group of DP, so `max(EP) ≤ DP`. This caps the EP degree exactly when scaling needs more EP. Folding flattens the attention parallelism map and allows MoE parallelism to be folded with arbitrary sub-groups of attention.
- **The construction** (Fig 1):
  - Attention 4-D group: `TP × CP × DP × PP`.
  - MoE 4-D group: `TP × EP × DP × PP` — TP here is "Expert-TP" (ETP); DP here is "Expert-DP" (EDP).
  - Only invariant: PP groups + members per PP group must match. Everything else is independent.
- **Two main benefits**:
  1. Pick the right parallelism per layer — EP is far more comm-efficient than ETP, so replace ETP with EP and fold the saved capacity into attention TP.
  2. Folded mappings let intra-layer comm fit within high-bandwidth intra-node networks (NVLink) rather than crossing slower inter-node links.
- **Flexible token-level dispatcher** as the load-bearing systems component:
  - Handles both **token-dropping** (Switch-Transformer style, with capacity factor) and **token-dropless** (Megablocks style) under arbitrary parallelism combinations.
  - Eliminates sequence-length dependencies in the dispatcher path.
  - Supports dynamic tensor shapes — critical because the per-rank token count varies with routing.
  - Three-stage EP flow: token dispatching (AllToAll), expert computation (no comm), token restore (inverse permutation).
- **Mathematical formulation of MoE** (paper § 3.1):
  - Output: `y = Σ g_e(x) · f_e(x)` over E experts.
  - Top-K gating: `g_e(x_i) = s_i` if `i ∈ TopK(s, K)`, else 0; `s = G(W_g · x)`.
  - Capacity per expert: `CF · L / E` where L = total tokens, E = experts, CF ≥ 1 = capacity factor. Tokens above capacity are dropped (in the token-dropping path).
- **Headline performance numbers** (H100 GPUs):
  - **Mixtral 8×22B: 49.3% MFU**.
  - **Qwen2-57B-A14B: 39.0% MFU**.
  - "Outperforming existing methods" — explicit comparison points are in the eval section against vanilla Megatron-LM hybrid parallelism + DeepSpeed.
- **Scale validation**: 1,024 H100 GPUs, sequences up to 128K tokens. Critical for thousand-GPU-scale training of OSS frontier MoE models.
- **Open-source**: shipped in [NVIDIA/Megatron-LM](https://github.com/NVIDIA/Megatron-LM), called Megatron-Core. The technique isn't theoretical — it's the production recipe.

## Visual observations

**Figure 1 — MoE Parallel Folding mappings** (load-bearing)

![Two-panel diagram. Left: prior approach — EP nested inside DP, so max(EP) ≤ DP. Right: MoE Parallel Folding — attention uses TP×CP×DP×PP independently; MoE uses TP×EP×DP×PP independently; only PP shape must match. Visualization of the parallelism-group folding](../../raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall-figures/marker-page-004-000.jpeg)

The whole paper's contribution in one diagram. Without this, the "decouple attention and MoE mappings" claim is abstract; with it, the constraint relaxation is immediate.

**Figure 2 — Token-routing dataflow under folded parallelism** (`../../raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall-figures/figure-002.png`)

![Four-GPU MoE routing schematic: per-GPU attention layers → routers → AlltoAll across EP groups → AlltoAll across TP groups → FFN TP1/TP2 expert shards → ReduceScatter Y → AlltoAll back → Unpermute](../../raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall-figures/figure-002.png)

The token-flow diagram that operationalizes the folded mapping. Load-bearing because the spatial topology of cross-GPU AlltoAll-EP / AlltoAll-TP / ReduceScatter operations is exactly what the optimization rearranges — text alone flattens the data flow into a list and loses the parallel-group structure.

**Figure 8 — LM-loss validation, MCore baseline vs Parallel-Folding** (`../../raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall-figures/figure-008.png`)

![Line chart of LM-loss validation: MCore 0.9 (cyan) and Parallel-Folding TP2/CP2/PP2/EP8/ETP1 (gray) curves tracking each other tightly from step 0 to ~8k steps, both converging from ~5.5 to ~2.1](../../raw/raindrop/arxiv.org/2025-10-28-moeparallel-folding-heterogeneous-parall/2025-10-28-moeparallel-folding-heterogeneous-parall-figures/figure-008.png)

The "decoupling doesn't hurt quality" proof — loss curves overlap throughout training. Load-bearing because the visual overlap of the two lines is what makes the equivalence claim quickly legible; a textual "loss matched within 0.05" doesn't convey the same robustness signal.

- **Figures 4-7, 9** (supporting, ablation curves): per-knob ablations of TP, EP, CP, DP, PP across Mixtral and Qwen2. Underlying support for the 49.3% / 39.0% MFU headlines. Read the captions for which axis is being varied.

## What this changes

- **For MoE pretraining at scale**: the load-bearing recipe ships in Megatron-Core. Teams training their own MoE foundation models can adopt this directly. The 49.3% MFU on Mixtral 8×22B is a meaningful baseline for "what's achievable."
- **For framework design**: heterogeneous parallelism mappings between layer types is a generalizable principle. Vision-language, speech-language, MoD-MoE-mix architectures all have layer-type heterogeneity that could benefit from analogous folding.
- **For pre-training infra teams**: the EP-degree ceiling (`≤ DP`) was a real-world constraint that limited MoE scaling. Removing it changes what TP/EP/DP allocations are feasible at 512+ GPUs.

## Entities touched

[[NVIDIA]], [[Megatron-LM]], [[Megatron-Core]], [[MoE]], [[Mixtral]], [[Qwen]], [[DeepSeek-MoE]], [[Switch Transformer]], [[GShard]], [[GLaM]], [[Megablocks]], [[H100]]

## Topics touched

[[MoE Training]], [[Hybrid Parallelism]], [[Tensor Parallelism]], [[Expert Parallelism]], [[Context Parallelism]], [[Pipeline Parallelism]], [[LLM Training Systems]]

## Raw source

[arxiv.org/abs/2504.14960](https://arxiv.org/abs/2504.14960) — 20-page paper · 3.8 MB PDF · 9 figures (Marker-extracted) + 7 captioned arxiv-HTML figures · code in [github.com/NVIDIA/Megatron-LM](https://github.com/NVIDIA/Megatron-LM). 18 NVIDIA co-authors. Read 2026-05-11 (Marker re-extraction).
