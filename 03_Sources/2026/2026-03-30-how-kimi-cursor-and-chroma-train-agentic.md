---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.philschmid.de/kimi-composer-context
tags: [post-training, inference, rl-post-training, agentic-training]
---

# [2026-03-28] How Kimi, Cursor, and Chroma Train Agentic Models with RL

## TL;DR

Three recent technical reports — Moonshot AI's Kimi K2.5, Cursor's Composer 2, and Chroma's Context-1 — each train specialized agentic models with RL, converging on four shared principles: start from a strong base, train inside the production harness, use outcome-based rewards, and run large-scale asynchronous rollouts.

## Key claims

- **[[Kimi K2.5]]** (1T parameter / 32B active [[MoE]]) introduces Agent Swarm via PARL (Parallel-Agent RL): the orchestrator learns to decompose tasks into parallel sub-agents using `create_subagent` and `assign_task` tools; sub-agents are frozen so only the orchestrator's coordination logic is optimized, solving the credit-assignment problem.
- PARL reward has three components: performance (`r_perf`), parallelism (`r_parallel`, prevents serial collapse), and finish (`r_finish`, prevents spurious parallelism); auxiliary coefficients are annealed to zero so final policy optimizes solely for performance.
- Agent Swarm reduces inference latency by up to 4.5× while improving accuracy; on BrowseComp it achieves 78.4% (vs. 60.6% single-agent), surpassing GPT-5.2 Pro (77.9%).
- [[Cursor]] Composer 2 trains in the exact same production harness users interact with, including a shadow deployment of the Cursor backend; internal CursorBench tasks have median 181 lines changed vs. 7–10 on SWE-bench.
- Cursor's RL infrastructure runs rollouts in Firecracker VMs on Anyrun (capable of 500+ pods/second, supports filesystem-level snapshotting); inference partners with Fireworks AI, with delta-compressed weight syncs to S3 every training step.
- Cursor uses GRPO variant with modifications: removes length standardization term (introduces length bias) and skips advantage normalization by std dev (over-amplifies noise when all rollouts have equal correctness).
- Cursor's real-time RL loop runs in ~5 hours end-to-end, enabling multiple checkpoint deploys per day; Multi-Token Prediction (MTP) layers provide 2–3× faster inference via self-distillation.
- Self-summarization in Composer 2 chains multiple generations with the final outcome reward applied across the whole chain, so the model learns when and how to summarize through RL rather than via explicit supervision.
- Chroma [[Context-1]] is a 20B parameter search-only agent trained on [[gpt-oss-20B]] base; it uses a `prune_chunks` tool to selectively discard retrieved documents, freeing context for further search.
- Context-1's reward uses F-beta score with beta weighting recall 16× over precision (missing a document is worse than including an irrelevant one); a separate process reward credits documents encountered during search even if later pruned.
- All three teams encountered and patched reward hacking: Cursor's model emitted broken tool calls; Kimi's orchestrator fell into serial collapse or spurious parallelism; Chroma's agent converged to single-search-then-quit.

## Visual observations

*No load-bearing images — article is prose with no charts, diagrams, or figures.*

## What this changes

- Establishes a common template for agentic RL: production-harness training + outcome rewards + parallel rollouts, with reward design as the key iterative knob.
- Purpose-trained smaller models (Chroma 20B, Cursor based on 32B active) compete with frontier models on their target tasks at substantially lower cost.

## Entities touched

[[Moonshot AI]], [[Kimi K2.5]], [[Cursor]], [[Chroma]], [[MoE]], [[AutoResearch]]

## Topics touched

[[RL Post-Training]], [[Agentic AI Infrastructure]]

## Raw source

[philschmid.de/kimi-composer-context](https://www.philschmid.de/kimi-composer-context) — Philipp Schmid blog post, 2026-03-28, markdown. Read 2026-05-15.
