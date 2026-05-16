---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# GTE-Qwen

Alibaba embedding model family fine-tuned from Qwen LLM base with bidirectional attention, MTEB top-ranked

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[GTE-Qwen]] 从[[Qwen]] LLM Base微调为嵌入模型，三个核心机制：推理时设 `is_causal=False` 启用双向注意力、额外Instruction Tuning解锁预训练能力、改进InfoNCE损失（分母扩展至4项含反向对比，τ=0.01）；token表示取序列最后一个真实token的embedding；gte-Qwen2-7B-instruct曾登顶MTEB leaderboard第一。 — [[2025-05-27-gte-qwen系列-feishu-docs]]
