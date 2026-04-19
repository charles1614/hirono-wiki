---
created: 2026-04-19
updated: 2026-04-19
type: topic
source_count: 1
---

# Stochastic Gradient Descent

The workhorse optimization algorithm for neural networks. Samples a minibatch, computes the gradient via [[Backpropagation]], and updates parameters in the direction that locally reduces loss.

## Current understanding

Thin (1 source). Named in [[2026-04-19-llm-pretraining-chapter-3]] as the baseline optimizer iteratively updating parameters after random initialization. The chapter's point: pretraining replaces the *random* initialization that SGD would otherwise optimize from; it doesn't replace SGD itself.

## Open threads

- In modern practice, SGD per se is rarely used directly at LLM scale — Adam/AdamW variants dominate. The chapter's framing ("SGD and other optimization algorithms") nods at this but doesn't elaborate.
- How do learning rate schedules + warmup change the picture during pretraining vs fine-tuning?

## Sources drawn on

- [[2026-04-19-llm-pretraining-chapter-3]] — SGD as the baseline optimizer for neural-net parameter updates
