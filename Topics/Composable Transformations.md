---
created: 2026-04-20
updated: 2026-04-20
type: topic
source_count: 1
---

# Composable Transformations

The programming-model idea — most associated with [[JAX]] — that operations like automatic differentiation, compilation, vectorization, and parallelization should be **orthogonal transformations** on functions that compose freely in any order. `jit(vmap(grad(f)))` means "compile a vectorized gradient function of f"; each transformation wraps the next with well-defined semantics.

## Current understanding

The primitives (per [[JAX]]):
- `jax.grad` — reverse-mode autodiff. Produces a new function returning gradients.
- `jax.jit` — just-in-time compilation via [[XLA]].
- `jax.vmap` — automatic batching along a named axis.
- `jax.pmap` — single-program, multiple-data parallel map across devices.

Composition is the point. You can `jit` a `vmap` of a `grad` of an ordinary Python function and it becomes a compiled, vectorized per-example gradient — without rewriting the original `f`. The cost is that every `f` in this chain must be **functionally pure** (no side effects, no mutation, explicit PRNG state). That constraint is non-negotiable — it's what makes the safety of arbitrary composition provable.

The contrast: [[PyTorch]]'s transformations (`torch.compile`, `torch.vmap`, autograd tape, `torch.func`) are available but less orthogonally composable — PyTorch started with an OOP `nn.Module` model and is adding functional layers on top, rather than starting functional.

## Open threads

- Does the purity cost drive researchers away in practice, or does Flax/Haiku smooth it enough that the choice is neutral?
- PyTorch's `torch.func` module is the explicit attempt to bring composable-transform semantics to PyTorch. How close is it to JAX's model today?
- This topic is algorithmic-layer; [[Kernel Authoring Languages]] is kernel-layer. Both are lenses on "how you extract accelerator performance" — composable transforms via graph compilation, vs hand-written kernels. The interesting question is where they meet (Inductor → [[Pallas]], XLA → TPU).

## Sources drawn on

- [[2026-04-20-deepwiki-jax-overview]] — primitives, composability principle, functional-purity requirement
