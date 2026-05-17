---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# Context-1

Chroma's 20B-parameter agentic search model trained to retrieve supporting documents via self-editing context with RL

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Trained with CISPO (128 queries/step, 8 rollouts each = 1,024 trajectories/step); reward uses F-beta score with recall weighted 16× over precision, plus a process reward crediting documents encountered during search even if later pruned; `prune_chunks` tool removes irrelevant chunks under a fixed 32k token budget harness. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
- SFT warmup used Kimi K2.5 to generate trajectories filtered by recall quality; high-recall kept in full, zero-recall trajectories included at up to 5% as negative examples. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
