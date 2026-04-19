---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 2
tier: seen
---

# NumPy

The de facto Python array-computing library. Reference API that [[JAX]] mirrors deliberately (`jax.numpy as jnp`) so code moves between them with minimal change — JAX adds composable transformations and accelerator support on top.

## Synthesis

Thin (1 source). In the JAX ecosystem, NumPy's role is "familiar API + trusted semantics"; everything NumPy does, JAX does too, just with autodiff, JIT, device placement, and pure-function constraints added.

## Observations

- JAX is NumPy-compatible by design; the primary migration is `import numpy as np` → `import jax.numpy as jnp`. — [[2026-04-20-deepwiki-jax-overview]]
- Key semantic differences: JAX requires functional purity (NumPy allows mutations); JAX PRNG is stateless with explicit keys (NumPy's is stateful). — [[2026-04-20-deepwiki-jax-overview]]
