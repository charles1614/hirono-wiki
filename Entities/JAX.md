---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 8
tier: active
---

# JAX

Google's array-programming framework with composable transforms (grad, vmap, jit, pmap); built on XLA; foundation for Pathways + Gemini training.

## Synthesis

*Regenerated from Observations below.*

## Observations

- JAX's design centers on four composable function transformations — `jax.grad`, `jax.jit`, `jax.vmap`, `jax.pmap` — that can be freely composed in any order (e.g., `jit(vmap(grad(f)))`); functional purity (no in-place mutations, explicit PRNG keys) is enforced as a prerequisite for safe transformation and parallelization. — [[2026-01-20-deepwiki-jax-01-overview]]
- The execution pipeline is 4-stage: Python → Jaxpr IR (typed, first-order functional representation) → MLIR/StableHLO → XLA-compiled device code; hardware support spans CPU, NVIDIA GPU (CUDA), AMD GPU (ROCm), and Google TPU natively without code changes. — [[2026-01-20-deepwiki-jax-01-overview]]
- The Tracer/Primitive/Jaxpr triad is the mechanism enabling composable transformations: Tracer objects intercept array operations and dispatch via `Primitive.bind()` to the active Trace context; EvalTrace executes concretely, JaxprTrace records equations, JVPTrace computes primal+tangent, VmapTrace adds batch dimensions — same primitive, four interpretations. — [[2026-01-20-deepwiki-jax-03-core-architecture]]
- `jax.jit`'s three-stage pipeline is trace → lower Jaxpr to MLIR/StableHLO/XLA HLO → compile and cache; cache keys encode function identity, input shapes/dtypes/sharding, static-arg hashes, and device assignment — a shape change alone forces a full recompile; buffer donation (`donate_argnums`) reuses input buffer memory in-place at the cost of invalidating the original reference. — [[2026-01-20-deepwiki-jax-04-transformation-system]]
- [[AI Hypercomputer]] JAX AI Images (JAII) for TPUs include Qwix (quantization), Tokamax (custom kernels), Optax, PyGrain, array-record, cloud-accelerator-diagnostics; GPU variant adds NGC CUDA DL base + TransformerEngine (NVIDIA); quarterly release cadence, rev-bumped for security patches. Latest TPU: JAX 0.9.0-rev1 (2026-02-03); latest GPU: JAX 0.7.2 with CUDA DL 25.06-rev1 (2025-09-30). — [[2026-01-16-os-and-docker-images-ai-hypercomputer-go]]
