---
created: 2026-04-20
updated: 2026-04-20
type: entity
refs: 1
tier: seen
---

# TensorFlow

Google's first-generation deep-learning framework. In the 2026 landscape, predominantly referenced as a comparison baseline rather than an active target — research has largely moved to [[PyTorch]] and [[JAX]].

## Synthesis

Thin (1 source). Positioned in the JAX overview as the third point in a framework comparison (vs NumPy, vs PyTorch, vs TensorFlow). TensorFlow 2.x opts into [[XLA]] via `jit_compile`; JAX is always-XLA natively. The comparison framing hints that TensorFlow is no longer the frontier framework it once was.

## Observations

- Opts into [[XLA]] via `jit_compile`; JAX uses XLA natively by default. Positioned as a higher-level framework with Keras-style abstractions, in contrast to JAX's low-level composable-transformations model. — [[2026-04-20-deepwiki-jax-overview]]
