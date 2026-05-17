---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 5
tier: active
---

# Neutrino

PTX-based dynamic instrumentation framework for GPU kernels enabling eBPF-style programmable observability

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Neutrino通过LD_PRELOAD劫持GPU驱动API，在[[PTX]]层动态插入探针指令（Snippet + Tracepoint + Map三要素），探针寄存器与原始Kernel完全隔离，每线程拥有独立Map存储位置，实现了"编译后插桩+运行时观测"的可编程GPU性能分析，填补[[Nsight Compute]]无法按条件/自定义触发的空白。 — [[2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针]]
