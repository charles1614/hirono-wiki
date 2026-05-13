---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: entity
refs: 4
tier: active
---

# Speculative Decoding

Inference technique class where a lightweight draft model generates candidate token sequences subsequently verified by the target model in a single forward pass, enabling wall-clock speedups without changing output quality.

## Synthesis


Speculative decoding accelerates autoregressive inference by having a lightweight draft model propose a sequence of candidate tokens that the target model then verifies in a single parallel forward pass, preserving output distribution while reducing wall-clock latency. The EAGLE family (EAGLE, EAGLE-2, EAGLE-3) represents the dominant iterative-refinement line: EAGLE-3 abandons feature-prediction loss in favor of direct token prediction with multi-layer feature fusion, and introduces a training-time test that feeds the draft model its own prior outputs during training to close the gap with inference-time conditions. A key finding from EAGLE-3 is that draft-model speedup now scales proportionally with training-data volume — a scaling law that earlier methods saturated quickly because their feature-prediction constraint capped expressive capacity. Empirically, EAGLE-3 reaches up to 6.5x speedup over greedy decoding (HumanEval, LLaMA-Instruct 3.1 8B) and a 40% throughput gain at batch size 64 in SGLang, directly refuting the prior assumption that speculative decoding degrades large-batch throughput. The lossless guarantee is preserved throughout: speculative sampling acceptance criteria ensure the target model's output distribution is unchanged, making the technique a drop-in serving optimization rather than a quality trade-off.


## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
