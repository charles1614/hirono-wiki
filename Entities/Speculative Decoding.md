---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 11
tier: active
---

# Speculative Decoding

Inference technique class where a lightweight draft model generates candidate token sequences subsequently verified by the target model in a single forward pass, enabling wall-clock speedups without changing output quality.

## Synthesis

<!-- TODO: re-regenerate Synthesis from merged Observations (post-merge 2026-05-16) -->
Speculative decoding accelerates autoregressive inference by having a lightweight draft model propose a sequence of candidate tokens that the target model then verifies in a single parallel forward pass, preserving output distribution while reducing wall-clock latency. The EAGLE family (EAGLE, EAGLE-2, EAGLE-3) represents the dominant iterative-refinement line: EAGLE-3 abandons feature-prediction loss in favor of direct token prediction with multi-layer feature fusion, and introduces a training-time test that feeds the draft model its own prior outputs during training to close the gap with inference-time conditions. A key finding from EAGLE-3 is that draft-model speedup now scales proportionally with training-data volume — a scaling law that earlier methods saturated quickly because their feature-prediction constraint capped expressive capacity. Empirically, EAGLE-3 reaches up to 6.5x speedup over greedy decoding (HumanEval, LLaMA-Instruct 3.1 8B) and a 40% throughput gain at batch size 64 in SGLang, directly refuting the prior assumption that speculative decoding degrades large-batch throughput. The lossless guarantee is preserved throughout: speculative sampling acceptance criteria ensure the target model's output distribution is unchanged, making the technique a drop-in serving optimization rather than a quality trade-off.


## Observations

- **Suffix Decoding** (model-free speculative): pattern-matches request suffix against a cache of prior outputs; no draft model weights. Analysis of 22 Claude Code sessions (17,487 turns) found 39.3% output-pattern repetition, enabling 22% TPOT reduction on top of MTP baseline for GLM-4.7 (mean TPOT 25.13 ms → 19.63 ms). Effective specifically for agentic coding workloads with high structural repetition. — [[2026-01-26-optimizing-glm4-moe-for-production-65-fa]]
- Seer's **adaptive grouped speculative sampling** (arXiv:2511.14617) is a no-draft-model variant: a Distributed Grouped Draft Server maintains one Compressed Suffix Tree (CST) per RL prompt group, aggregating token sequences from all in-flight sibling responses; inference instances periodically pull CST deltas and use them for local n-gram speculation with beam-search top-k path selection; draft length adapts to current concurrency (longer drafts at the tail stage when concurrency is low). Unlike traditional speculative decoding, draft tokens derive from peer responses rather than a separate model. — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]

<!-- merged from `Speculative Sampling` on 2026-05-16 -->

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_

