---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# DeepSeek-V3

DeepSeek's third-generation dense Transformer model, powering V3.1 and V3.2 variants

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- FlashMLA is purpose-built for DeepSeek-V3 series inference: 128 query heads (MQA mode, h_kv=1), d_qk=576 (512 NoPE + 64 RoPE), d_v=512, page block size=64 tokens; these parameters determine the V32 FP8 KVCache format (656 bytes/token) and place MLA decoding in compute-bound territory on H800 (ratio ≈ 256 flops/byte vs. ~258 crossover). Powers V3, V3.1, V3.2 inference. — [[2026-01-27-deepwiki-flashmla-01-overview]]
