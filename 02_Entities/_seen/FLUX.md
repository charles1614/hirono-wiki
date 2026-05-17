---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 1
tier: seen
---

# FLUX

ByteDance + PKU system that hides tensor-parallel communication behind computation by fusing fine-grained comm and compute tiles into a single CUTLASS kernel, achieving up to 96% communication overlap.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_
- HuggingFace [[Diffusers]] + [[Torch Compile]] recipe (PyTorch DevLog, May 2026): **~1.5× speedup on Flux-1-Dev** with no quality loss; single image takes 6.7s on [[H100]] in bf16 (~33 GB weights). `compile_repeated_blocks` reduces compile latency from 67.4s → 9.6s (7×). — [[2026-05-12-pytorch-devlog]]
