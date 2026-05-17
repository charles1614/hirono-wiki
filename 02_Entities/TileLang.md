---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 4
tier: active
---

# TileLang

Python DSL for high-performance GPU kernel development, successor to Triton approach from TVM lineage

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[TileLang]] 是 Wang Lei 博士基于 TVM 体系发展的 GPU kernel DSL，以 tile 为基本操作粒度，通过 T.gemm/T.reduce 等原语直接表达共享内存层次的数据流动；被 DeepSeek V3.2 DSA 算子（Lightning Indexer、Top-k Selector、Sparse MLA）的高性能实现所采用，但复杂算子（如 Sparse MLA）仍需深度参与 TileLang 开发才能编写。 — [[2025-10-09-从deepseek-v3-2-dsa算子看tilelang编译器的细节]]
