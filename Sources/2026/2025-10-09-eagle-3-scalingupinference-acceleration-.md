---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2503.01840
tags: [speculative-decoding, inference, eagle, sglang, llm, scaling-law]
---

# [2025-10-09] EAGLE-3: Scaling up Inference Acceleration via Training-Time Test

## TL;DR

EAGLE-3 paper (arXiv:2503.01840, v3 Apr 2025) — third generation of the EAGLE speculative-decoding family. **Headline win: up to 6.5× speedup** (HumanEval, LLaMA-Instruct 3.1 8B target), ~1.4× over EAGLE-2. **The deeper finding: a *scaling law* for inference-acceleration training data** — EAGLE-3's draft-model speedup grows proportionally with training-data scale, a relation that didn't hold for EAGLE/EAGLE-2 because their feature-prediction constraint capped how much data helped. EAGLE-3 abandons feature prediction in favor of direct token prediction + multi-layer feature fusion + a new "training-time test" trick. Already integrated in [[SGLang]] — **40% throughput improvement at batch size 64**.

## Key claims

- **Speculative sampling = lossless inference speedup.** Draft model generates candidate tokens cheaply; target model verifies in parallel; multiple tokens land per forward pass. EAGLE family reuses the target's *top-layer features* (just before LM head) instead of training a fully-independent draft model.
- **Scaling-data problem with EAGLE/EAGLE-2.** Throwing more training data at the draft model gave diminishing returns. Root cause: the **feature prediction loss** (`l_fea`) — forces the draft model to predict the target's top-layer features, not just tokens. The feature constraint limits draft-model expressiveness and caps how much data can help.
- **EAGLE-3's two architectural changes:**
  1. **Drop feature prediction** (`l_fea` removed). Draft model predicts tokens directly. Acceptance rate on first draft token improves significantly with more data.
  2. **Use multi-layer feature fusion** instead of only top-layer features. Top-layer features are inherently tied to the next-token distribution; multi-layer (low/mid/high) features give the draft model richer information for next-next-token prediction.
- **The remaining problem.** Removing `l_fea` causes draft-step-1 output (â_{t+1}) to drift far from ground-truth feature, so step-2 input deviates from training distribution → step-2 acceptance rate collapses. Fix: include step-1 outputs in training (the **"training-time test"** technique). The training process now mirrors the test-time multi-step rollout.
- **Compatible with EAGLE-2's drafting tree.** EAGLE-3 ships parallelized + drop-in for the tree-search draft strategy from the prior version.
- **Speedup numbers** (Table 1, temperature=0, MT-bench / GSM8K):
  - Vicuna 13B: 1.0× → vanilla, 1.9× / 2.1× speculative, EAGLE-3 **5.6×**
  - LLaMA-Instruct 3.1 8B: EAGLE-3 **4.1×** (vs EAGLE-2 ~3.2×)
  - LLaMA-Instruct 3.3 70B: EAGLE-3 **4.4×**
  - DeepSeek-R1 (LLaMA 8B distill): EAGLE-3 **5.0×**
  - HumanEval / LLaMA-Instruct 3.1 8B: **6.5×** (highest result; new code-task max)
- **Speculative sampling at high batch sizes finally wins.** Conventional wisdom: speculative decoding helps small batches, hurts throughput at large batches (verification dominates). EAGLE-3 in production-grade [[SGLang]] **improves throughput by 40% at batch size 64**.
- **EAGLE-3 trained on ~8× more data than EAGLE.** The scaling-law claim implies further speedup is unlocked by more data; previous EAGLE versions plateaued.

### Speedup table (reproduced from Fig 2 / §6 results)

| Target model | Eval dataset | Vanilla | Speculative (prev) | EAGLE-3 |
|---|---|---|---|---|
| Vicuna 13B | MT-bench | 1.0× | 1.9× / 2.1× | **5.6×** |
| LLaMA-Instruct 3.1 8B | MT-bench | 1.0× | 3.6× / 3.2× | **4.1×** |
| LLaMA-Instruct 3.3 70B | MT-bench | 1.0× | 4.4× | **4.4×** |
| DeepSeek-R1-Distill-LLaMA 8B | GSM8K | 1.0× | 2.8× | **5.0×** |
| LLaMA-Instruct 3.1 8B | HumanEval | 1.0× | (lower) | **6.5×** |

## Visual observations

**Fig 1 — Scaling law on MT-bench (LLaMA 3.1 8B)** (load-bearing)

![EAGLE-3 scaling law — top-right of page 1: speedup ratio + accept length both grow with data scale for EAGLE-3, flat for EAGLE-2](../../raw/raindrop/arxiv.org/2025-10-09-eagle-3-scalingupinference-acceleration-/2025-10-09-eagle-3-scalingupinference-acceleration--images/page-001.png)

Page 1 of the paper, with Fig 1 in the top-right and Fig 2 below it. **Fig 1 is the novel-claim chart**: two-panel diagram showing speedup-vs-data-scale (top) and accept-length-vs-data-scale (bottom) for EAGLE-2 (flat) vs EAGLE-3 (positive slope on both). The increasing-scaling-law claim is literally the slope of these lines. Fig 2 below it shows the speedup comparison bar chart across target models (Vicuna 13B / LLaMA 3.1 8B / 3.3 70B / DeepSeek-R1) — confirmation of the table reproduced above.

- **Fig 3 — Training-time test methodology** (`../../raw/raindrop/arxiv.org/2025-10-09-eagle-3-scalingupinference-acceleration-/2025-10-09-eagle-3-scalingupinference-acceleration--images/page-002.png`) — Three-panel diagram showing the architectural progression: EAGLE (top, with `l_fea`) → EAGLE-without-feature-pred (middle, fixes scaling but breaks step-2 acceptance) → EAGLE-3 with training-time test (bottom, fixes both). Supporting — the textual explanation in Key Claims covers it; image is helpful for implementers.
- **Fig 4 — Acceptance rate curves** (same page as Fig 3) — 0-α + 1-α vs data scale. Shows the step-2 acceptance-rate collapse when `l_fea` is removed alone, and recovery with training-time test. Supporting.
- **Fig 7 — Token-position acceptance rates** — EAGLE-3 stays higher across longer draft chains (the "error accumulation" failure mode of EAGLE). Supporting.

## Entities touched

[[EAGLE]], [[EAGLE-3]], [[SGLang]], [[Llama]], [[Vicuna]], [[DeepSeek]], [[Medusa]], [[HASS]], [[Falcon-speculative]]

## Topics touched

[[Speculative Decoding]], [[LLM Inference Systems]], [[Scaling Laws]]

## Open questions

- Scaling law is observed on LLaMA-Instruct 3.1 8B. Does the same slope hold for 70B-class models, or does the curve flatten when the target has more capacity? (Table 1 shows 3.3 70B at 4.4× — already near the upper end seen for 8B at 4.1×; possibly a hint.)
- 6.5× is on HumanEval (code generation, low-entropy outputs). Code-task speedup is known to be the easy case for speculative decoding (predictable patterns); MT-bench (chat, high-entropy) caps around 4×. What's the speedup ceiling for *reasoning* tasks where the next token has high effective entropy?
- **40% throughput improvement at batch=64 in SGLang** is striking — speculative decoding's worst-case-batched regime now shows clear wins. Cross-ref [[2025-11-17-feature-sglang-tracing-fine-grained-trac]] for how SGLang observability tracks this; cross-ref the LLM inference systems survey ([[2026-05-08-a-survey-of-llm-inference-systems]]) which calls speculative decoding out as a major lever.
- The "training-time test" trick is a generic principle (rollout-aware training). Does it transfer to non-speculative-decoding draft-model paradigms (e.g., Medusa's multi-head prediction)?
- DeepSeek-R1 + reasoning models are explicitly called out — long reasoning chains make per-token speedup compound across the chain. What does EAGLE-3 do to total reasoning-output cost (not just per-token)?

## Raw source

[arxiv.org/abs/2503.01840](https://arxiv.org/abs/2503.01840) — full PDF preserved at `raw/raindrop/arxiv.org/2025-10-09-eagle-3-scalingupinference-acceleration-/2025-10-09-eagle-3-scalingupinference-acceleration-.pdf` (946 KB). Authors: Yuhui Li (Peking U + Waterloo + Vector), Fangyun Wei (Microsoft Research), Chao Zhang (Peking U), Hongyang Zhang (Waterloo + Vector). Code: github.com/SafeAILab/EAGLE.
