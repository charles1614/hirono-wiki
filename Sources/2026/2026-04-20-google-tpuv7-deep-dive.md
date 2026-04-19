---
created: 2026-04-20
updated: 2026-04-20
type: source
raw_source: https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the
tags: [google, tpu, anthropic, gpu, nvidia, kernels]
highlights: true
---

# [2026-04-20] Google TPUv7: the 900lb gorilla in the room

## TL;DR

[[Google]] is moving its [[TPU]] from a JAX-internal accelerator into a serious public-facing alternative to [[NVIDIA]] GPUs by exposing [[Pallas]] (its kernel-authoring language, analogous to [[NKI]] on [[Trainium3]] or CUDA/Triton on NVIDIA) and integrating into the [[vLLM]] / [[SGLang]] inference stacks. Native PyTorch backend for TPU is in flight (PyTorch XLA RFC #9684); when it lands, vLLM/SGLang plan to drop the JAX-via-TorchAX translation path. Architectural reality: TPUs handle KV-cache attention very differently from GPUs (no scatter, fine-grained pipelining instead) — paged attention kernels need a TPU-native rewrite, not a port.

## Key claims

- **Pallas = TPU's CUDA/NKI/Triton equivalent.** Custom-kernel authoring DSL for TPUs; required to extract the chip's real performance.
- **PyTorch on TPU, native:** [[PyTorch]] XLA RFC #9684 will give TPUs a first-class PyTorch backend. Today vLLM/SGLang reach TPUs by translating PyTorch → [[JAX]] via TorchAX; the native backend would let them drop that bridge.
- **TPU-aware kernels in vLLM:** [[Google]] has open-sourced & merged TPU-optimized kernels into vLLM — paged attention, compute/comms-overlapped GEMM, quantized matmul.
- **Inductor → Pallas codegen.** Work to make [[PyTorch]]'s Inductor compiler emit Pallas kernels for TPU (analogous to its CUDA codegen path). When mature, may unlock kernel fusion + pattern matching inside vLLM's PassManager.
- **Helion as a higher-level frontend:** [[Pallas]] is being integrated as a codegen target for Helion (PyTorch-Labs' tile-based DSL), so kernel authors don't have to write Pallas directly.
- **TPUs handle KV-cache differently from GPUs.** vLLM's standard paged-attention uses virtual-memory-style paging with scatter ops — TPUs don't support that well. TPU port uses fine-grained operation pipelining instead: prefetch query + KV blocks for the next sequence so memory loading overlaps compute. Specifically: "Ragged Paged Attention v3."
- **Two TPU-architectural pain points** named explicitly: TPUs are slow at sorting operations, and one of the kernels described couldn't overlap communication with compute.

## Entities touched

[[Google]], [[TPU]], [[Pallas]], [[vLLM]], [[SGLang]], [[NVIDIA]], [[PyTorch]], [[JAX]], [[Anthropic]], [[NKI]], [[Trainium3]]

## Topics touched

[[Kernel Authoring Languages]], [[Training Infrastructure]]

## Open questions

- How does TPU perf/$ for inference compare to H100/B200/[[Trainium3]] today, given the kernel maturity gap (TPU-native paged attention is still being built, vs. GPU's mature ecosystem)?
- Does the PyTorch XLA native backend obsolete TorchAX entirely, or remain a niche translator for non-PyTorch JAX models?
- Per-watt: TPUv7 vs Trainium3 vs H100 — the article hints at TCO favorability but the highlights don't quantify.
- "Slow at sorting" + "couldn't overlap comm with compute" — are these v7-specific or fundamental TPU architecture properties? Future TPU generations addressing them?

## Raw source

- URL: https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the
- Raindrop bookmark_id: 1556353208 (highlighted — 12 highlights)
- Captured: 2026-01-22
- Ingested: 2026-04-20
