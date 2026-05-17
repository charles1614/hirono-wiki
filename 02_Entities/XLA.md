---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# XLA

Google's accelerated-linear-algebra compiler; targets TPU + GPU; foundation for JAX and TensorFlow execution.

## Synthesis

*Regenerated from Observations below.*

## Observations

- XLA is [[JAX]]'s backend compiler: JAX lowers its Jaxpr IR to MLIR then StableHLO, which XLA compiles to optimized device code for CPUs, NVIDIA GPUs (CUDA), AMD GPUs (ROCm), and Google TPUs; the compilation enables kernel fusion, memory layout optimization, and hardware-specific code generation. — [[2026-01-20-deepwiki-jax-01-overview]]
- XLA's JIT cache in JAX uses a `weakref_lru_cache` keyed on function identity (weak ref), input abstract values (shape + dtype + sharding), static argument hashes, and JAX config flags; cache misses trigger full re-lowering through the MLIR → StableHLO → XLA HLO pipeline. — [[2026-01-20-deepwiki-jax-04-transformation-system]]
