---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 3
tier: active
---

# Kimi K2.5

Moonshot AI multimodal 1T-parameter / 32B-active MoE model trained with PARL (Parallel-Agent RL) and Agent Swarm

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Introduces **Agent Swarm** via PARL (Parallel-Agent RL): a 1T-parameter / 32B-active MoE model that learns to decompose tasks into parallel sub-agents (orchestrator with `create_subagent`/`assign_task` tools; sub-agents frozen); achieves 4.5× latency reduction and 78.4% on BrowseComp (vs. 60.6% single-agent, surpassing GPT-5.2 Pro 77.9%). PARL reward has three components annealed to zero over training. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
- Chroma's Context-1 used Kimi K2.5 as the inference backend to generate SFT warmup trajectories, filtering by recall quality; Cursor's Composer 2 also started from Kimi K2.5 (1T/32B MoE) as the base model. — [[2026-03-30-how-kimi-cursor-and-chroma-train-agentic]]
