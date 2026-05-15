---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 14
tier: active
---

# DeepSeek-R1

DeepSeek reasoning model, late 2024 / early 2025; emphasizes inference-time test/think capability.

## Observations

- DeepSeek R1 is built on the DeepSeek V3 architecture (MLA + sparse MoE) and is the model whose January 2025 release brought widespread attention to DeepSeek V3. Raschka's survey uses R1/V3 as the opening reference architecture, noting the impact was due to both performance and the public architectural detail shared. — [[2026-01-28-the-big-llm-architecture-comparison]]
- R1 uses RLVR with GRPO (format reward + language consistency reward + verifier reward); it is a dedicated reasoning model, not a hybrid. The V3.1/V3.2 lineage moves toward hybrid instruct/reasoning in the same model; Raschka speculates a dedicated R2 may still be in development separately. — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
- Alpamayo-R1's [[NVIDIA Cosmos]]-Reason backbone was pre-trained on 24,700 driving-scene VQA samples distilled from DeepSeek-R1 to instill reasoning traces; DeepSeek-R1 is also used as the evaluation model in Alpamayo-R1's GRPO reasoning-quality reward, scoring logical consistency, causal correctness, and contextual accuracy of generated CoC traces. — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- Karpathy named DeepSeek R1 paper as the canonical demonstration of RLVR (Reinforcement Learning from Verifiable Rewards): R1 spontaneously developed strategies that look like "reasoning" — breaking problems into intermediate calculations, iterative problem-solving — via optimization against verifiable rewards, strategies that would have been very difficult to specify directly via SFT or RLHF. — [[2025-12-20-2025-llm-year-in-review]]
