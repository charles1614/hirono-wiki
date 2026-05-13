---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Speculative Sampling

## What

Latency-reduction technique that uses a small draft model to propose tokens, verified in parallel by the large target model.

## Current understanding

**Speculative sampling** (also called speculative decoding) is a latency-reduction technique for autoregressive language model inference. A small, fast **draft model** proposes a sequence of *k* candidate tokens in a single forward pass; the large **target model** then verifies all *k* tokens in a single parallel forward pass. Tokens accepted up to the first rejection are kept verbatim; the first rejected token is resampled from the target distribution. Because the target model's forward pass is parallelized over the draft sequence, wall-clock time per accepted token drops substantially when the draft acceptance rate is high — without changing the output distribution of the target model.

The **correctness guarantee** is the technique's most important property: with an appropriately constructed acceptance/rejection rule, the joint output distribution is provably identical to what the target model would produce by sampling token-by-token. This is not an approximation; it is an exact match. The acceptance probability for draft token *x* at position *t* is min(1, p_target(x|context) / p_draft(x|context)), and a correction sample is drawn on rejection. The result is that speculative decoding is a drop-in replacement for standard sampling — no fine-tuning, no quality degradation.

**Throughput and latency tradeoffs** depend on three factors: (1) the draft model's speed advantage relative to the target, (2) the draft acceptance rate (a function of how well the draft distribution approximates the target's), and (3) the number of draft tokens *k* proposed per verification round. In practice, draft models that are 5–10× smaller than the target and domain-matched to the workload achieve acceptance rates of 70–90 %, delivering 2–3× end-to-end speedups on generation-heavy tasks without additional hardware.

Several **variants and extensions** have been explored: *self-speculative decoding* (the target model drafts its own continuations using early-exit layers), *tree-based speculation* (the draft produces a token tree rather than a linear sequence, allowing multiple candidate continuations to be verified simultaneously), and *medusa heads* (multiple auxiliary decoding heads attached to the target model predict tokens ahead without a separate draft model). Each variant trades implementation complexity against acceptance rate or hardware requirements.

**Practical deployment considerations** include draft model selection (must be fast, same tokenizer, reasonably correlated with target), batching dynamics (speculation is less beneficial when batch sizes are large because the target's compute is already well-utilized), and memory bandwidth (speculation shifts the bottleneck from memory-bandwidth to compute, which is the profitable regime on modern accelerators during memory-bandwidth-bound single-user inference).

The technique is now a standard component in serving stacks for large models; its value is highest in interactive, low-batch-size regimes (e.g., chat) and least in high-throughput offline batch inference where standard continuous batching already saturates hardware.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
