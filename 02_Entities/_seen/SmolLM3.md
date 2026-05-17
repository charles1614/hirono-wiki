---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# SmolLM3

Hugging Face small language model series (3B parameters, NoPE architecture)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- SmolLM3 (3B parameters, Hugging Face) uses NoPE (No Position Embeddings) — relying entirely on causal attention mask to maintain autoregressive order, without RoPE or absolute position embeddings. Ablations show NoPE yields better length generalization (less performance degradation on sequences longer than training length). Architecture is otherwise standard (Pre-Norm, GQA). Compared to Qwen3 4B in Raschka's survey: deeper but narrower. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
