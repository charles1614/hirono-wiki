---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/jax?file=03-core-architecture
tags: [training, tooling]
---

# [2026-01-20] DeepWiki JAX — Core Architecture

## TL;DR

Deep-dive into JAX's six-layer architecture: User API → Transformation → Tracing → Jaxpr IR → Compilation → Hardware Backend. The Tracer/Primitive/Jaxpr triad is the mechanism that makes composable transformations work — each transformation layer intercepts primitives and records or re-interprets them differently.

## Key claims

- The `Tracer` class intercepts all array operations by overriding dunder methods; each tracer holds an `aval` (abstract value — shape + dtype without data) and a reference to the active `Trace` context, which determines how operations are processed.
- `Primitive.bind()` dispatches to the current trace's `process_primitive()`: EvalTrace calls `impl()` to run concretely, JaxprTrace records a Jaxpr equation, JVPTrace computes primal + tangent, VmapTrace adds batch dimensions — same primitive, four interpretations.
- Jaxpr is a typed, first-order functional IR: a straight-line list of `JaxprEqn` records (primitive + in-vars + out-vars); `eval_jaxpr()` simply walks this list and updates a `{Var → value}` environment.
- `ShapedArray` (shape + dtype + weak_type + optional sharding) is the canonical abstract value; "weak type" prevents Python scalar `1` from promoting an `int32` array to `int64` during type promotion.
- PyTrees (tuples, lists, dicts, custom registered classes) are JAX's container model: `tree_flatten` produces a flat leaf list + a `PyTreeDef` treedef; transformations operate on leaves and `tree_unflatten` reconstructs the original structure — gradient PyTrees match the parameter PyTree structure exactly.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[JAX]], [[XLA]]

## Topics touched

[[GPU Programming Models]]

## Raw source

[wiki.litenext.digital/wiki/jax?file=03-core-architecture](https://wiki.litenext.digital/wiki/jax?file=03-core-architecture) — DeepWiki auto-generated architecture reference for JAX; captured 2026-01-20. Read 2026-05-15.
