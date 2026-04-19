---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 9
tier: active
---

# Google

Hyperscaler + AI lab. Designs the [[TPU]] family of accelerators (v7 is the current generation positioned against [[NVIDIA]] H100/B200), authors [[Pallas]] (the TPU kernel language), and is moving from JAX-first internal use to a public-facing TPU + [[PyTorch]] story.

## Synthesis

Thin (1 source). Position so far: Google is doing for TPUv7 what [[AWS]] is doing for [[Trainium3]] — opening the kernel layer + the framework integration to outside teams (vLLM, SGLang, PyTorch XLA) rather than keeping it internal-only.

## Observations

- Has open-sourced and merged TPU-optimized kernels into [[vLLM]]: paged attention, compute/comms-overlapped GEMM, quantized matmul. — [[2026-04-20-google-tpuv7-deep-dive]]
- Pursuing native [[PyTorch]] backend for TPU via PyTorch XLA RFC #9684 — would supersede the current PyTorch→[[JAX]]→TPU translation route via TorchAX. — [[2026-04-20-google-tpuv7-deep-dive]]
