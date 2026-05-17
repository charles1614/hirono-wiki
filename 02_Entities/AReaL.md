---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 7
tier: active
---

# AReaL

Async RL training framework for LLMs developed by inclusionAI

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- AReaL's async RL mechanism interrupts rollout mid-sequence when a new checkpoint is broadcast: partial responses are saved and KV cache cleared, then generation resumes from prefill with the new weights; a single final sequence may contain segments from different θ values. This eliminates within-rollout bubble and enables rollout-trainer overlap. — [[2025-06-11-异步rl框架areal速览]]
- "Decouple PPO" in AReaL constructs a separate reference policy π_behave (the most recent θ that generated each response segment) to form a tighter trust region than the mixed-θ old policy; algebraically equivalent gradient direction and magnitude to standard PPO when unclipped. Implementation: behave logP computed by rollout backend ([[SGLang]]/vLLM), other logP terms by trainer ([[DeepSpeed]]/FSDP/Megatron); framework precision differences cause numerical mismatches. — [[2025-06-11-异步rl框架areal速览]]
- Listed in Awesome-ML-SYS-Tutorial's AReaL section with a full code walkthrough (also on Zhihu). — [[2025-07-03-github-zhaochenyang20-awesome-ml-sys-tut]]
