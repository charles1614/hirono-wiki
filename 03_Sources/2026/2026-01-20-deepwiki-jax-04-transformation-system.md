---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/jax?file=04-transformation-system
tags: [training, tooling]
---

# [2026-01-20] DeepWiki JAX — Transformation System

## TL;DR

Mechanistic walkthrough of JAX's four primary transformations — `jit`, `grad`, `vmap`, `pmap` — explaining how each is implemented as a distinct trace interpreter over Jaxpr IR. The three-stage JIT pipeline (Tracing → MLIR Lowering → XLA Compilation + caching) is detailed with cache-key semantics and buffer donation.

## Key claims

- `jax.jit` uses a three-stage pipeline: trace Python function with Tracers to emit Jaxpr, lower Jaxpr to MLIR → StableHLO → XLA HLO, compile and cache the executable; subsequent calls with matching shape/dtype hit the cache and skip recompilation entirely.
- JIT cache keys include: function identity (weak ref), input abstract values (shape + dtype + sharding), static argument hashes, JAX config flags, and target device assignment — a shape change alone causes a cache miss and full recompile.
- Static arguments (`static_argnums` / `static_argnames`) become compile-time constants embedded in the Jaxpr; each distinct static-arg value produces a separate compilation, trading recompile cost for specialized code.
- Buffer donation (`donate_argnums`) allows JAX to reuse input buffer memory for outputs in-place; the donated array becomes invalid after the call — XLA may or may not physically reuse the buffer, but the API contract invalidates the original reference unconditionally.
- The `lax.cond` primitive (not Python `if`) is required for JIT-compatible control flow; Python conditionals on traced values cause trace-time errors because control flow must be representable in the Jaxpr.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[JAX]], [[XLA]]

## Topics touched

[[GPU Programming Models]], [[Kernel Fusion]]

## Raw source

[wiki.litenext.digital/wiki/jax?file=04-transformation-system](https://wiki.litenext.digital/wiki/jax?file=04-transformation-system) — DeepWiki auto-generated transformation-system reference for JAX; captured 2026-01-20. Read 2026-05-15.
