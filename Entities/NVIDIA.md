---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 6
tier: active
---

# NVIDIA

Dominant ML accelerator vendor. The reference point against which [[Trainium3]], [[TPU]], and other custom silicon are positioned. Programming surface is CUDA C++ / Triton / CuTe-DSL — see [[Kernel Authoring Languages]] for cross-vendor mapping.

## Synthesis

Thin (1 source). Implicit baseline in most accelerator coverage; explicit comparator in TPUv7 article via the kernel-language analogy ([[Pallas]] ↔ cuTile / Triton / CuTe-DSL). Mature ecosystem (vLLM's GPU paged attention is the reference design that other accelerators are forced to redesign around).

## Observations

- Reference vendor for kernel-authoring languages: Pallas is positioned as TPU's equivalent to cuTile / Triton / CuTe-DSL on NVIDIA. — [[2026-04-20-google-tpuv7-deep-dive]]
- vLLM's standard paged-attention design (virtual-memory-style KV paging with scatter ops) is GPU-native and assumes NVIDIA architectural primitives that TPUs don't support. — [[2026-04-20-google-tpuv7-deep-dive]]
