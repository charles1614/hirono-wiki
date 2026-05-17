---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 9
tier: active
---

# Quantization

Model weight and activation compression technique (e.g., FP8, INT4) for reducing memory and compute cost; covered under the survey's model optimization and memory management sections.

## Synthesis



Limited evidence in this batch's Observations — Quantization functions as a cross-cutting topic across more specific entities (FP8, NVFP4, FlashMLA's FP8 KVCache, MLA's FP8 block-wise quantization in DeepSeek-V3, Qwen3-235B-A22B FP8 deployment) rather than carrying its own dedicated source citations here. The themes recurring in those adjacent contexts: forward activations and weights typically use E4M3 (higher precision) while gradients use E5M2 (wider range); block-wise schemes (128×128 weight blocks, 1×128 activation blocks) require CUTLASS-direct GEMM because PyTorch's `torch._scaled_mm` supports only tensor-wise and row-wise; quantization-granularity-vs-TP-divisibility is a load-bearing deployment constraint (Qwen3 1536/TP8=192 not divisible by 128 forcing TP4); and dequantization overhead on H800 (no native FP8→BF16 cast) requires DSM-based cross-CTA pipelines to recover throughput. A dedicated Synthesis awaits more direct Observations cited to this entity.



## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
