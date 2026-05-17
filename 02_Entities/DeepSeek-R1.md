---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 19
tier: active
---

# DeepSeek-R1

DeepSeek reasoning model, late 2024 / early 2025; emphasizes inference-time test/think capability.

## Synthesis


DeepSeek-R1 is the dedicated reasoning model built on the DeepSeek V3 architecture (MLA + sparse MoE, 671B total / 37B active), with its January 2025 release the catalyst that brought broader attention to DeepSeek V3 itself — Raschka's survey uses R1/V3 as the opening reference architecture, noting that public architectural detail combined with capability drove the impact. R1 was trained via RLVR with GRPO using a triple reward (format reward + language consistency reward + verifier reward) and is a pure reasoning model rather than a hybrid, contrasting with the V3.1/V3.2 lineage that moves toward unified instruct/reasoning in a single model. Karpathy named the R1 paper as the canonical demonstration of Reinforcement Learning from Verifiable Rewards: R1 spontaneously developed reasoning-like strategies — problem decomposition, iterative refinement — via optimization against verifiable rewards, strategies difficult to specify directly through SFT or RLHF. NVIDIA Alpamayo-R1's Cosmos-Reason backbone was pre-trained on 24,700 driving-scene VQA samples distilled from DeepSeek-R1 to instill reasoning traces, and R1 also serves as the evaluation model in Alpamayo-R1's GRPO reasoning-quality reward (scoring logical consistency, causal correctness, contextual accuracy of generated Chain-of-Causation traces). The R1-0528 update released open weights with public reasoning tokens at performance on par with OpenAI o1 and was available same-day from 7 providers via OpenRouter; community notes characterize it as open-weight rather than reproducible from source since training data is undisclosed.


## Observations

- DeepSeek R1 is built on the DeepSeek V3 architecture (MLA + sparse MoE) and is the model whose January 2025 release brought widespread attention to DeepSeek V3. Raschka's survey uses R1/V3 as the opening reference architecture, noting the impact was due to both performance and the public architectural detail shared. — [[2026-01-28-the-big-llm-architecture-comparison]]
- R1 uses RLVR with GRPO (format reward + language consistency reward + verifier reward); it is a dedicated reasoning model, not a hybrid. The V3.1/V3.2 lineage moves toward hybrid instruct/reasoning in the same model; Raschka speculates a dedicated R2 may still be in development separately. — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
- Alpamayo-R1's [[NVIDIA Cosmos]]-Reason backbone was pre-trained on 24,700 driving-scene VQA samples distilled from DeepSeek-R1 to instill reasoning traces; DeepSeek-R1 is also used as the evaluation model in Alpamayo-R1's GRPO reasoning-quality reward, scoring logical consistency, causal correctness, and contextual accuracy of generated CoC traces. — [[2025-12-16-一文读懂英伟达最新开源vla大模型]]
- Karpathy named DeepSeek R1 paper as the canonical demonstration of RLVR (Reinforcement Learning from Verifiable Rewards): R1 spontaneously developed strategies that look like "reasoning" — breaking problems into intermediate calculations, iterative problem-solving — via optimization against verifiable rewards, strategies that would have been very difficult to specify directly via SFT or RLHF. — [[2025-12-20-2025-llm-year-in-review]]
- R1-0528 (May 28, 2025 update) released on HuggingFace: 671B total / 37B active parameters (MoE), fully open weights with public reasoning tokens, performance on par with OpenAI o1; available same-day from 7 providers via OpenRouter. Community notes it is open-weight rather than reproducible from source (training data undisclosed). HN discussion: 451 points, 250 comments. — [[2025-05-29-deepseek-r1-0528-hacker-news]]
- In a Chinese community model shootout (linux.do, 2025-05-28), R1-0528 was subjectively rated top-tier for HTML/CSS animation code generation alongside ByteDance's Doubao, outperforming [[Qwen3-235B]] (rated poorly by community) and Claude 3.7 Sonnet/4 Opus; however, same-model variance across sessions was noted as high ("抽卡" effect). — [[2025-05-28-685482]]
