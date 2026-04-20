---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-20'
type: entity
refs: 3
tier: active
---

# XLA

Accelerated Linear Algebra — [[Google]]'s graph compiler for ML. Originally built for [[TensorFlow]], now the shared substrate underneath [[JAX]] (native), [[TPU]] (always), and increasingly [[PyTorch]] on TPU (PyTorch XLA path). Consumes MLIR / StableHLO and emits hardware-specific code.

## Synthesis

Thin (2 sources) but structurally important: XLA is the compile layer where JAX, PyTorch-on-TPU, and TPU kernel work all meet. The TPUv7 article and the JAX overview both route through XLA, even though they don't reference each other — this is the shared infrastructure they both assume. See [[Kernel Authoring Languages]] for the layer *below* XLA (where [[NKI]], [[Pallas]], CUDA/Triton operate).

## Observations

- JAX's compilation pipeline is Python → Jaxpr → MLIR/StableHLO → XLA → device code; compiled executables cached for reuse. — [[2026-04-20-deepwiki-jax-overview]]
- [[TensorFlow]] 2.x can opt into XLA via `jit_compile`; JAX is natively always XLA. — [[2026-04-20-deepwiki-jax-overview]]
- [[PyTorch]] XLA RFC #9684 is the mechanism by which [[Google]] is bringing PyTorch native to [[TPU]] — once shipped, [[vLLM]] and [[SGLang]] plan to drop the PyTorch→[[JAX]]→TPU translation via TorchAX. — [[2026-04-20-google-tpuv7-deep-dive]]
