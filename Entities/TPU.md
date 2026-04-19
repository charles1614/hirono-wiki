---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 8
tier: active
---

# TPU

[[Google]]'s family of ML accelerators. Optimized for static-shape, batch-friendly workloads (originally [[JAX]]-first); architecturally distinct from [[NVIDIA]] GPUs in ways that affect kernel design — notably no efficient scatter ops, slow sorting.

## Synthesis

Thin (1 source). Notable architectural divergence from GPUs: KV-cache paging strategies (virtual-memory + scatter on GPU) don't port; TPUs use fine-grained pipelining with prefetch overlap instead. Programming TPUs requires [[Pallas]] for performance work — by analogy with CUDA on [[NVIDIA]] or [[NKI]] on [[Trainium3]].

## Observations

- Architectural quirks named in TPUv7: slow at sorting operations; one important attention kernel couldn't overlap communication with compute. — [[2026-04-20-google-tpuv7-deep-dive]]
- KV-cache attention requires a TPU-native rewrite (Ragged Paged Attention v3) — vLLM's GPU paging design uses scatter ops TPUs don't support well. — [[2026-04-20-google-tpuv7-deep-dive]]
- PyTorch native backend is still pending (PyTorch XLA RFC #9684); current path is PyTorch → JAX via TorchAX → TPU. — [[2026-04-20-google-tpuv7-deep-dive]]
