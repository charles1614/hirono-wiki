---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Backpropagation

The gradient-computation algorithm underpinning neural-network training. Propagates error gradients from the output layer backward through the network to update parameters.

## Current understanding

Thin (1 source). Mentioned in [[2026-04-19-llm-pretraining-chapter-3]] as the standard training mechanism paired with [[Stochastic Gradient Descent]]. The chapter is explaining *where pretraining fits in the broader training story* — backprop is the underlying mechanics that both pretraining and fine-tuning share.

## Open threads

- Any interesting modern variants (backprop through time, reversible architectures, gradient checkpointing)? Not addressed in Chapter 3.

## Sources drawn on

- [[2026-04-19-llm-pretraining-chapter-3]] — BP named as the baseline gradient-propagation algorithm
