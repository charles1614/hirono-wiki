---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://wiki.litenext.digital/wiki/jax?file=01-overview
tags: [training, tooling]
---

# [2026-01-20] DeepWiki JAX — Overview

## TL;DR

A DeepWiki survey of the JAX Python library for accelerator-oriented array computation. JAX composes four primary function transformations — `jax.grad`, `jax.jit`, `jax.vmap`, `jax.pmap` — that apply freely to any pure Python function and lower via Jaxpr IR to XLA for execution on CPUs, GPUs, and TPUs.

## Key claims

- JAX's core design is composable function transformations: `jit(vmap(grad(f)))` compiles a vectorized gradient function without any special-cased variant; composability is a first-class guarantee, not a convenience wrapper.
- The execution pipeline is 4-stage: Python → Jaxpr IR → MLIR/StableHLO → XLA-compiled device code; the Jaxpr IR is a typed, first-order functional representation that enables aggressive optimization and hardware-specific code generation.
- Functional purity is enforced: no in-place array mutations, explicit PRNG key threading, no global state in transformed functions; this enables safe parallelization and transformation composition.
- Hardware support matrix: Linux x86_64 gets full coverage (CPU/NVIDIA GPU/TPU/AMD GPU); macOS aarch64 gets CPU plus experimental Apple GPU; Windows GPU support is partial or experimental across all variants.
- JAX is positioned explicitly as a research project from Google, not an official product; ecosystem frameworks (Flax, Haiku, Optax) build on its primitives.

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[JAX]], [[XLA]]

## Topics touched

[[Data Loading Pipelines]]

## Raw source

[wiki.litenext.digital/wiki/jax?file=01-overview](https://wiki.litenext.digital/wiki/jax?file=01-overview) — DeepWiki auto-generated reference doc for JAX; captured 2026-01-20. Read 2026-05-15.
