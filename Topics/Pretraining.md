---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Pretraining

The training regime where a model is first trained on a general-purpose (usually large, unlabeled) dataset to learn transferable representations, then adapted to a specific task via [[Fine-tuning]]. In the LLM era, "pretraining" specifically denotes the large-data, large-model training pass that produces a base model.

## Current understanding

Pretraining is a form of [[Transfer Learning]]: the source task produces parameters; those parameters initialize the downstream model. The LLM-specific variant is distinguished by **scale conjunction** — both data and parameters must be massive.

Four structural reasons pretraining exists (per [[2026-04-19-llm-pretraining-chapter-3]]):
1. Label scarcity — leverage unlabeled data
2. Prior-knowledge injection — models learn world/linguistic priors
3. Cross-task transfer — shared latent structure gets exploited
4. Interpretability via learned abstractions (contested in the LLM era)

## Open threads

- Chapter 3 frames the four problems as independent; scaling laws suggest they may collapse into "more compute + data + params → everything improves."
- How much of modern pretraining is "classical pretraining" vs. something new? RLHF, instruction tuning, and post-training increasingly blur the pretrain/fine-tune line.
- What does this topic look like from a training-infrastructure lens? [[Training Infrastructure]] touches the hardware/software side; this topic is the algorithmic side.

## Sources drawn on

- [[2026-04-19-llm-pretraining-chapter-3]] — foundational definition + the four motivating problems
