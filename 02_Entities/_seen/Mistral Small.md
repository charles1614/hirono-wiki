---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Mistral Small

Mistral AI's Mistral Small 3.1 24B and 3.4 119B dense models catalogued in the gallery.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Mistral Small 3.1 (24B) dropped sliding window attention (earlier Mistral models used it) in favor of standard GQA to enable optimized FlashAttention code paths, prioritizing inference latency over KV-cache size. Mistral 3 Large (675B, Dec 2025) adopted DeepSeek V3's architecture almost exactly, changing only the expert size/count ratio (fewer, larger experts vs DeepSeek's many small experts) and adding a multimodal vision encoder. Raschka notes Mistral uses its own tokenizer, so Mistral 3 Large was trained from scratch rather than initialized from DeepSeek V3. — [[2026-01-28-the-big-llm-architecture-comparison]]
