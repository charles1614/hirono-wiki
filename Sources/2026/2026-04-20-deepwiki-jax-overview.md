---
created: 2026-04-20
updated: 2026-04-20
type: source
raw_source: https://wiki.litenext.digital/wiki/jax?file=01-overview
tags: [jax, deepwiki, xla, jit, autodiff]
highlights: true
---

# [2026-04-20] DeepWiki — JAX overview

## TL;DR

[[JAX]] is a Python library from [[Google]] Research for accelerator-oriented array computation and composable function transformations — an evolution of [[Autograd]]. Its signature move is that `grad`, `jit`, `vmap`, and `pmap` are orthogonal transformations you can compose in any order (`jit(vmap(grad(f)))` is a standard idiom). Under the hood everything lowers to [[XLA]] via a custom IR called Jaxpr → MLIR/StableHLO → hardware (CPU / [[NVIDIA]] GPU / [[TPU]] / AMD GPU). Design requires functional purity (no side effects, no in-place mutation, explicit PRNG keys); the payoff is that any transformation can wrap any other safely.

## Key claims

- **Four composable transformations** as the architectural core: `jax.grad` (reverse-mode autodiff), `jax.jit` (XLA compilation), `jax.vmap` (automatic vectorization), `jax.pmap` (multi-device parallel map). Order of composition is meaningful but all orders are well-defined.
- **Jaxpr IR** sits between Python functions and compiled device code. The pipeline is Python → Jaxpr → MLIR / StableHLO → [[XLA]] → device code. Compiled executables are cached for reuse.
- **Multi-hardware, one codebase**: CPU, [[NVIDIA]] GPU (CUDA + cuDNN), AMD GPU (ROCm), [[Google]] [[TPU]] (first-class, custom kernels), plus a plugin system for custom backends. Same JAX code runs anywhere.
- **Functional purity is a contract, not a suggestion**: no side effects, no in-place mutation, stateless PRNG (explicit key threading). Non-negotiable for safe transform composition.
- **History**: developed at [[Google]] Research as the successor to the [[Autograd]] project; API is deliberately [[NumPy]]-compatible.
- **Comparisons framed explicitly**:
  - vs [[NumPy]]: same API surface; JAX adds autodiff + JIT + accelerators + explicit PRNG.
  - vs [[PyTorch]]: functional vs OOP (`nn.Module`); trace-based transform vs eager autograd tape; `pmap`/`pjit` + GSPMD vs DDP/FSDP; growing vs mature ecosystem.
  - vs TensorFlow 2.x: native XLA vs optional `jit_compile`; composable transforms vs function decorators.
- **Ecosystem layers**: Flax, Haiku (model definition), Optax (optimizers) all build on JAX — but the overview flags that JAX itself has "sharp edges" around functional purity, tracing, and dynamic shapes.

## Entities touched

[[JAX]], [[XLA]], [[Google]], [[TPU]], [[NVIDIA]], [[PyTorch]], [[NumPy]], [[Autograd]]

## Topics touched

[[Composable Transformations]]

## Open questions

- This overview calls JAX "an active research project, not an official Google product" — given the [[Google]] [[TPU]] push described in [[2026-04-20-google-tpuv7-deep-dive]] (PyTorch XLA as Phase 2, TorchAX bridging PyTorch to JAX), is that framing still accurate in 2026? JAX feels more like production infrastructure than a research side project.
- The XLA dependency connects two sources that seem unrelated at first: this one (JAX uses XLA) and the TPUv7 piece (PyTorch XLA RFC #9684 for TPU). The shared substrate is worth its own page eventually — see [[Kernel Authoring Languages]] for the adjacent cross-vendor view.
- Functional purity + dynamic shapes is called out as a "sharp edge." How much does this cost researchers in practice, and how do the Flax/Haiku abstractions soften it?
- What's the status of Flax vs Haiku vs Optax today? The overview lists them but doesn't compare; 2026 ecosystem may have consolidated.

## Raw source

- URL: https://wiki.litenext.digital/wiki/jax?file=01-overview
- Raindrop bookmark_id: 1553122883 (highlighted — 2 highlights: "developed at Google Research, evolution of Autograd" and "Jaxpr")
- Captured: 2026-01-20
- Ingested: 2026-04-20
- Note: DeepWiki is a Claude-Code-generated Next.js site mirroring GitHub project READMEs — the source is effectively a structured distillation of JAX's own README.md
