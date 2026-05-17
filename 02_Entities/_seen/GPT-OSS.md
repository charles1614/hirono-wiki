---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# GPT-OSS

OpenAI's open-weight GPT model family released in 2025; includes GPT-OSS-120B used in TRT-LLM serving guide.

## Synthesis

*Regenerated from Observations below.*

## Observations

- GPT-OSS (gpt-oss-20B and gpt-oss-120B, OpenAI's first open-weight models since GPT-2) uses MoE with 32 experts / 4 active per token with larger expert size than Qwen3's 128 experts / 8 active — bucking the trend toward many small experts. Notable architecture quirks: attention bias units (learned per-head bias logits on attention scores, functioning as attention sinks without modifying tokenized inputs) not seen since GPT-2; sliding window attention in every other layer similar to Gemma 3 but with a 1:1 ratio. The gpt-oss-120B is wider (embedding dim 2880) vs Qwen3 30B-A3B's deeper (48 layers vs 24) architecture at comparable active parameter count. — [[2026-01-28-the-big-llm-architecture-comparison]]
