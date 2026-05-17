---
created: 2026-05-17
updated: 2026-05-17
type: entity
refs: 2
tier: seen
---

# Diffusers

Hugging Face diffusion pipeline library; torch.compile achieves ~1.5x speedup on Flux-1-Dev with compile_repeated_blocks cutting compile latency 7x

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- HuggingFace Diffusers + [[Torch Compile]] recipe (PyTorch DevLog, May 2026) delivers **~1.5× speedup on Flux-1-Dev with no quality loss**. Key knobs: `compile_repeated_blocks` cuts compile latency **7×** (67.4s → 9.6s) while keeping speedup; `dynamic=True` avoids recompiles on shape changes; compatible with CPU offloading, NF4 quantization, LoRA hot-swap without losing compiled kernels. — [[2026-05-12-pytorch-devlog]]
