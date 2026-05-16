---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 9
tier: active
---

# OpenAI Triton

OpenAI-developed kernel-authoring DSL with compiler-managed Tensor-Core mapping; also OpenAI ships Triton-kernel optimizations for its MoE models.

## Observations

- _(stub — populate as sources reference this entity. Reindex will count refs and may promote to active tier at ≥3.)_

<!-- merged from `Triton` on 2026-05-13 -->

- (auto-populated as Sources cite this entity)
- SGLang's `jit_kernel` system uses Triton's `perf_report` / `triton.testing` harness as the benchmarking layer for JIT kernels (benchmark files compare JIT kernel vs `torch` baseline via `triton.testing.Benchmark`); Triton is both a peer authoring DSL and a benchmarking dependency in this stack. — [[2026-03-16-sglang-claude-skills-add-jit-kernel-skil]]
- [[OpenAI Triton]] 的 `GPUDriver` 类（`/python/triton/backends/driver.py`）直接复用 [[PyTorch]] CUDA API（`torch.cuda.get_device_capability`/`set_device`/`current_stream`）进行设备与流管理；kernel编译由 `build.py` 通过subprocess调用nvcc/clang生成PTX/CUBIN；`jit.py` 中 `JITFunction.run()` 获取当前stream后调用 `kernel.run()` 执行 `cudaLaunchKernel`；自动调优通过多次launch + CUDA events计时选最优配置。 — [[2025-05-27-pytorch-triton与runtime的三角虐恋]]

