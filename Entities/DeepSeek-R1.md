---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# DeepSeek-R1

DeepSeek reasoning model, late 2024 / early 2025; emphasizes inference-time test/think capability.

## Observations

- DeepSeek R1 is built on the DeepSeek V3 architecture (MLA + sparse MoE) and is the model whose January 2025 release brought widespread attention to DeepSeek V3. Raschka's survey uses R1/V3 as the opening reference architecture, noting the impact was due to both performance and the public architectural detail shared. — [[2026-01-28-the-big-llm-architecture-comparison]]
- R1 uses RLVR with GRPO (format reward + language consistency reward + verifier reward); it is a dedicated reasoning model, not a hybrid. The V3.1/V3.2 lineage moves toward hybrid instruct/reasoning in the same model; Raschka speculates a dedicated R2 may still be in development separately. — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
