---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Transfer Learning

A machine learning regime where a model trained on one task is repurposed (often via parameter transfer) to a different-but-related task. [[Pretraining]] is the dominant LLM-era special case.

## Current understanding

The core move: don't start from random initialization; start from parameters learned on something else. The transfer works when source and target share latent structure — e.g., "language" as a shared latent across any NLP task. Fine-tuning on a small target-domain dataset then specializes those parameters.

The illustrative analogy from [[2026-04-19-llm-pretraining-chapter-3]]: asking someone fluent in English to learn legal-document keyword extraction is fast; asking someone who doesn't know English to do the same task is slow or impossible. "Knowing English" is the transferable prior.

## Open threads

- When does transfer help, and when does it hurt? Negative transfer is a real phenomenon; under what conditions?
- How does scale interact with transfer? At LLM scale, does any task become a "transfer task" regardless of the original pretraining domain?

## Sources drawn on

- [[2026-04-19-llm-pretraining-chapter-3]] — pretraining framed as transfer learning special case
