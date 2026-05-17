---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 2
tier: seen
---

# PTX

NVIDIA's parallel thread execution intermediate assembly language for GPU kernels

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- PTX（Parallel Thread Execution）是CUDA C++/PyTorch/TensorFlow JIT等上层框架到GPU硬件SASS机器码的公共中间层，nvcc生成PTX后由ptxas汇编为.cubin；由于PTX对多代GPU架构保持稳定接口，可基于PTX构建跨架构的通用性能分析工具（如[[Neutrino]]）。 — [[2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针]]
