---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 8
tier: active
---

# Pallas

[[Google]]'s kernel-authoring language for [[TPU]]s. Same role as CUDA C++ / Triton on [[NVIDIA]] GPUs and [[NKI]] on [[Trainium3]]: the lower-level surface kernel engineers reach for when stock framework backends leave perf on the table. See [[Kernel Authoring Languages]] for the cross-vendor view.

## Synthesis

Thin (1 source). Programming model is positioned at the same layer as CUDA/NKI/Triton/CuTe-DSL — closer to the metal than PyTorch graph compilation, intended for hand-tuned performance kernels. Higher-level frontend (Helion) is being built so kernel authors don't always have to write Pallas directly. PyTorch's Inductor is being extended to emit Pallas as a codegen target.

## Observations

- Positioned as TPU's analog to cuTile / Triton / CuTe-DSL on NVIDIA. — [[2026-04-20-google-tpuv7-deep-dive]]
- Pallas is being integrated as a codegen target for Helion (PyTorch Labs' higher-level tile DSL). — [[2026-04-20-google-tpuv7-deep-dive]]
- Inductor → Pallas codegen pathway is in progress; once mature, may enable kernel fusion + pattern matching inside vLLM's PassManager. — [[2026-04-20-google-tpuv7-deep-dive]]
