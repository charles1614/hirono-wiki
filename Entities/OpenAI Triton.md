---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# OpenAI Triton

OpenAI-developed kernel-authoring DSL with compiler-managed Tensor-Core mapping; also OpenAI ships Triton-kernel optimizations for its MoE models.

## Observations

- _(stub — populate as sources reference this entity. Reindex will count refs and may promote to active tier at ≥3.)_

<!-- merged from `Triton` on 2026-05-13 -->

- (auto-populated as Sources cite this entity)
- SGLang's `jit_kernel` system uses Triton's `perf_report` / `triton.testing` harness as the benchmarking layer for JIT kernels (benchmark files compare JIT kernel vs `torch` baseline via `triton.testing.Benchmark`); Triton is both a peer authoring DSL and a benchmarking dependency in this stack. — [[2026-03-16-sglang-claude-skills-add-jit-kernel-skil]]

