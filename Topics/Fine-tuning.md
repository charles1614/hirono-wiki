---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Fine-tuning

The second phase after [[Pretraining]]: use the pretrained parameters as initialization and train (usually briefly, on a smaller dataset) to adapt the model to a specific task or domain.

## Current understanding

Thin (1 source). Described in [[2026-04-19-llm-pretraining-chapter-3]] as the specialization step that applies the pretrained "commonalities" to a specific target task with a smaller amount of labeled data. In the LLM era this encompasses supervised fine-tuning (SFT), instruction tuning, and — depending on terminology — RLHF-style post-training.

## Open threads

- Where does the pretraining/fine-tuning line actually live today? Many models do "mid-training" and multi-phase post-training.
- How much fine-tuning data is "enough"? The chapter says "少量" (a small amount) without quantifying.

## Sources drawn on

- [[2026-04-19-llm-pretraining-chapter-3]] — fine-tuning as the task-specific phase after pretraining
