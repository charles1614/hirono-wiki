---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 11
tier: active
---

# OpenAI Triton

OpenAI-developed kernel-authoring DSL with compiler-managed Tensor-Core mapping; also OpenAI ships Triton-kernel optimizations for its MoE models.

## Synthesis



OpenAI Triton is a Python-based DSL and compiler for GPU kernels that targets SIMT programming at a higher abstraction level than CUDA C++, compiling to PTX/CUBIN via nvcc or clang through a subprocess-based build path. Its runtime reuses PyTorch's CUDA device-management APIs directly (`torch.cuda.get_device_capability`, `torch.cuda.set_device`, `current_stream`), and the `JITFunction.run()` path retrieves the current CUDA stream before calling `cudaLaunchKernel`, making Triton a consumer of PyTorch's lazy-initialized CUDA context rather than an independent runtime. The auto-tuner benchmarks multiple tile configurations via CUDA events or the `triton.testing` harness to select the optimal launch shape per hardware target. In SGLang's kernel architecture Triton plays a dual role — both an authoring DSL for JIT kernels not depending on CUTLASS (the `jit_kernel` system) and the benchmarking layer via `triton.testing.Benchmark` for comparing JIT kernel throughput against torch baselines. Limited evidence so far on Triton's broader training-stack role; the strongest corpus citations concern its inference-kernel and benchmarking roles in SGLang and TensorRT-LLM, with the Triton MoE backend specifically required on H200 for gpt-oss-120b deployment because the TRTLLM backend doesn't support Hopper.



## Observations

- _(stub — populate as sources reference this entity. Reindex will count refs and may promote to active tier at ≥3.)_

<!-- merged from `Triton` on 2026-05-13 -->

- (auto-populated as Sources cite this entity)
- SGLang's `jit_kernel` system uses Triton's `perf_report` / `triton.testing` harness as the benchmarking layer for JIT kernels (benchmark files compare JIT kernel vs `torch` baseline via `triton.testing.Benchmark`); Triton is both a peer authoring DSL and a benchmarking dependency in this stack. — [[2026-03-16-sglang-claude-skills-add-jit-kernel-skil]]
- [[OpenAI Triton]] 的 `GPUDriver` 类（`/python/triton/backends/driver.py`）直接复用 [[PyTorch]] CUDA API（`torch.cuda.get_device_capability`/`set_device`/`current_stream`）进行设备与流管理；kernel编译由 `build.py` 通过subprocess调用nvcc/clang生成PTX/CUBIN；`jit.py` 中 `JITFunction.run()` 获取当前stream后调用 `kernel.run()` 执行 `cudaLaunchKernel`；自动调优通过多次launch + CUDA events计时选最优配置。 — [[2025-05-27-pytorch-triton与runtime的三角虐恋]]

<!-- merged from `Triton` on 2026-05-16 -->

- _(append cited bullets here as Sources reference this entity — one atomic claim per bullet, trailed with a Source wikilink)_

