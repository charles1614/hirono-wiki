---
created: 2026-05-12
updated: 2026-05-12
type: meta
---

# Entity aliases — canonical-name normalization

Operator-curated normalization hints for `hirono auto-detect-entities`. Maps spelling variants to the canonical entity slug so LLM-NER doesn't create duplicate stubs.

**Format**: `- <variant> → <canonical>` (one per line, exact-match left side, canonical right side must be an existing or about-to-be-created entity slug)

**NOT a scope gate** — auto-detect proposes any entity the LLM identifies regardless of whether it appears here. Absence from this file doesn't block stub creation; this file ONLY merges variants of names.

## Aliases

- LLaMA → Llama
- LLaMA-2 → Llama
- LLaMA-3 → Llama
- Llama 2 → Llama
- Llama 3 → Llama
- bfloat16 → BF16
- Bfloat16 → BF16
- BFloat16 → BF16
- fp16 → FP16
- fp8 → FP8
- fp4 → FP4
- nvfp4 → NVFP4
- Tile IR → CUDA Tile IR
- CUDA tile IR → CUDA Tile IR
- vllm → vLLM
- VLLM → vLLM
- sglang → SGLang
- DeepSeek V3 → DeepSeek-V3
- DeepSeek R1 → DeepSeek-R1
- DeepSeek-V3.1 → DeepSeek-V3
- Kimi-K2 → Kimi K2
- KimiK2 → Kimi K2
- FlashAttention v3 → FlashAttention-3
- FlashAttention 3 → FlashAttention-3
- FA3 → FlashAttention-3
- Multi-head Latent Attention → MLA
- Multi-Head Latent Attention → MLA
- Grouped Query Attention → GQA
- nvidia → NVIDIA
- Nvidia → NVIDIA
