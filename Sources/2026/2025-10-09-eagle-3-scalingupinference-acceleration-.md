---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2503.01840
tags: [speculative-decoding, inference, eagle, sglang, llm, scaling-law]
---

# [2025-10-09] EAGLE-3: Scaling up Inference Acceleration via Training-Time Test

## TL;DR

EAGLE-3 paper (Yuhui Li et al., PKU + MSR + Waterloo + Vector, arXiv:2503.01840 v3 Apr 2025) — third generation of the EAGLE speculative-decoding family. **Headline win: up to 6.5× speedup** (HumanEval, LLaMA-Instruct 3.1 8B target), ~1.4× over EAGLE-2. **The deeper finding: a *scaling law* for inference-acceleration training data** — EAGLE-3's draft-model speedup grows proportionally with training-data scale, a relation that didn't hold for EAGLE/EAGLE-2 because their feature-prediction constraint capped how much data helped. EAGLE-3 abandons feature prediction in favor of direct token prediction + multi-layer feature fusion + a new "training-time test" trick. Already integrated in [[SGLang]] — **40% throughput improvement at batch size 64**.

## Key claims

- **The scaling-law discovery is the load-bearing contribution.** Prior speculative methods (EAGLE, EAGLE-2, HASS) all saturate quickly with more training data because their feature-prediction loss `l_fea` constrains the draft model's expressiveness. EAGLE-3 removes that constraint — and discovers that draft-model speedup now scales with training data, just like target-model intelligence does. This was "never observed in previous works."
- **Three architectural changes** vs EAGLE-2:
  1. **Drop the feature prediction loss `l_fea`**. Only train on token prediction. This frees the draft model from having to mimic top-layer features.
  2. **Multi-layer feature fusion**: instead of consuming only top-layer features `f`, EAGLE-3 takes low/mid/high-level features `l, m, h` from the target model, concatenates to a 3k-vector, FC-reduces to k. The fused vector `g` carries richer semantic info across layers.
  3. **Training-time test**: during training, feed the draft model its OWN previous output `a` back as input (instead of always ground-truth features). This matches the inference-time distribution and fixes the previous EAGLE-2 issue where Step-2 acceptance rate `1-α` was poor because draft input `â_{t+1}` deviated from training data.
- **Inference pipeline**: alternates draft + verify. Step 1 reuses `g` directly from target model. Steps 2+ replace unavailable `g_I` with prior-step draft output `a_I`, concatenated with the sampled token embedding `e_do`, into the single-layer Transformer decoder. Same context-aware dynamic draft tree as EAGLE-2.
- **Self-attention masks** during training-time test: standard lower-triangular for Step 1; diagonal-only for Steps 2/3 (since prior draft outputs are siblings not ancestors). The "test step" can be computed via dot products instead of full matrix multiplication — cheap.
- **HASS comparison** — HASS modified attention similarly but for a different reason (mitigating error accumulation in feature prediction). HASS still keeps `l_fea` and still requires top-layer features. EAGLE-3 removes the constraint entirely; the scaling-law discovery is downstream of this difference.
- **Speedup numbers** (temperature=0, mean across 5 tasks):
  - Vicuna 13B: EAGLE-3 **5.51×** (EAGLE-2: 4.22×, EAGLE: 3.05×)
  - LLaMA-Instruct 3.1 8B: **4.44×** (EAGLE-2: 3.23×)
  - LLaMA-Instruct 3.3 70B: **4.12×** (EAGLE-2: 2.85×)
  - DeepSeek-R1-Distill-LLaMA 8B: **4.16×** (EAGLE-2: 3.26×)
  - Best single result: HumanEval on Vicuna 13B at **6.47×**.
  - Best on chat-task average: HumanEval-LLaMA 3.1 8B at MT-bench **5.58×** → wait actually the table headline says HumanEval V 13B 6.47x and MT-bench 5.58x. The "6.5×" headline is in the abstract.
- **Production-grade integration**: SGLang ships EAGLE-3 → **40% throughput improvement at batch size 64**. Earlier speculative methods were assumed to degrade large-batch throughput; this number directly refutes that for EAGLE-3.
- **Lossless guarantee preserved**: uses strict speculative-sampling acceptance criteria, no fine-tuning on eval tasks; doesn't modify target model weights. Generation quality unchanged.
- **Training data**: ~8× more than EAGLE-2 (ShareGPT 68K + UltraChat-200K 464K; OpenThoughts-114k-math added for the reasoning model). AdamW, lr 5e-5, grad clip 0.5, target model generates responses (not fixed dataset).

## Visual observations

**Figure 1 — Scaling law on MT-bench (LLaMA-Instruct 3.1 8B target)** (load-bearing)

![EAGLE-3 acceptance rate / speedup as a function of training data scale relative to ShareGPT — increasing curve for EAGLE-3, flat for EAGLE-2 and EAGLE. This is the scaling-law discovery in a single chart](../../raw/raindrop/arxiv.org/2025-10-09-eagle-3-scalingupinference-acceleration-/2025-10-09-eagle-3-scalingupinference-acceleration--figures/marker-page-000-010.jpeg)

The headline plot. Without this curve, "EAGLE-3 scales" is hand-waving; with it, the claim is concrete.

**Figure 3 — Training-time test vs prior draft architectures** (load-bearing)

![Three-panel diagram comparing EAGLE (feature prediction), feature-prediction-removed-but-no-train-time-test (middle), and EAGLE-3's training-time test (bottom). Feature flow with `f`, `t`, `a` symbols clearly distinguishing](../../raw/raindrop/arxiv.org/2025-10-09-eagle-3-scalingupinference-acceleration-/2025-10-09-eagle-3-scalingupinference-acceleration--figures/marker-page-002-000.jpeg)

The architectural diff vs EAGLE/EAGLE-2 — three panels showing why training-time test is necessary (without it, Step-2 acceptance rate tanks because draft input deviates from training distribution).

**Figure 5 — EAGLE-3 inference pipeline (3 steps)** (load-bearing)

![Three-step diagram of EAGLE-3 draft model: Step 1 uses target-model `g_how, g_can` + sampled `e_I`; Step 2 substitutes draft's own `a_I` for the unavailable `g_I`, paired with `e_do`; Step 3 does the same with `a_do, e_it`](../../raw/raindrop/arxiv.org/2025-10-09-eagle-3-scalingupinference-acceleration-/2025-10-09-eagle-3-scalingupinference-acceleration--figures/marker-page-003-004.jpeg)

The inference recipe in one picture. Anyone implementing EAGLE-3 reads this.

- **Figure 2 — Speedup comparison bar chart** (supporting): bar chart of various methods' speedups at temperature=0. Headline number visualization for marketing; details are in Table 1.
- **Figure 4 — Acceptance rate vs data scale** (supporting): supports Fig 1, showing the per-step acceptance breakdown.
- **Figure 6 — Attention mask diagrams for training-time test** (supporting): clarifies the implementation. Not strictly necessary if you trust Fig 3 + the text.

## What this changes

- **For frameworks**: speculative decoding at large batch is no longer assumed throughput-degrading. SGLang's 40% gain at batch 64 is the proof; vLLM and TensorRT-LLM should follow (and have, in subsequent releases).
- **For training data**: the discovery that draft-model quality scales with data parallels the target-model story. Investing in EAGLE-3 training data (vs better target models) becomes a meaningful axis.
- **For research**: removing constraints can unlock scaling laws. The HASS comparison is instructive — same attention-mask trick, different motivation, very different outcome. The principled-architecture lesson generalizes.
- **For the EAGLE line**: this is the third major iteration; the trajectory is "remove constraint, gain scale." Likely there's an EAGLE-4 that pushes this further (multi-layer fusion is one degree of freedom; what's the next constraint to remove?).
- **Pairs with**: [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] (orthogonal axis — disaggregation), [[2025-10-09-flux-fast-software-based-communication-o]] (orthogonal — comm-comp overlap).

## Entities touched

[[EAGLE]], [[EAGLE-2]], [[EAGLE-3]], [[HASS]], [[Medusa]], [[SGLang]], [[Vicuna]], [[LLaMA]], [[DeepSeek-R1]], [[Speculative Sampling]]

## Topics touched

[[Speculative Decoding]], [[LLM Inference Systems]], [[Scaling Laws]]

## Open questions

- The paper observes the scaling law on 8B-target. Does it hold at 70B+ as the draft-model capacity ceiling differs? The 70B numbers are good but the data-scaling curve isn't shown there.
- "Larger data size would lead to further improved speedup ratio" — at what point does the scaling plateau? Other scaling laws (Chinchilla-style) have inflection points; what does the draft-model curve look like at 10× more data?
- Multi-layer feature fusion as 3k→k FC is a specific choice. Why three layers (low/mid/high)? Would 5-layer fusion or learned-layer-selection do better? Architecturally simple but unexplored.
- The "context-aware dynamic draft tree" from EAGLE-2 — how does its branching policy interact with training-time test? They claim "fully compatible" but the dynamics seem coupled.
- DeepSeek-V3's multi-token prediction was inspired by EAGLE → EAGLE-3 was inspired by DeepSeek-V3's MTP. Is there an MTP-EAGLE-3 hybrid that's better than either?

## Raw source

[arxiv.org/abs/2503.01840](https://arxiv.org/abs/2503.01840) — 12-page paper · 924 KB PDF · 8 figures (Marker-extracted) + 7 captioned arxiv-HTML figures · code at [github.com/SafeAILab/EAGLE](https://github.com/SafeAILab/EAGLE). Read 2026-05-11 (Marker re-extraction).
