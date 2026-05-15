---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# ThunderKittens

C++ CUDA kernel template library from HazyResearch (Stanford) bridging CUTLASS performance and Python DSL usability for GPU kernel development

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- ThunderKittens（2024年10月，HazyResearch/Stanford）：C++模板库，三级抽象（warp/block/grid）对应GPU硬件层级，PyTorch风格API，自动shared memory swizzle layout选择；解决CUTLASS嵌套模板复杂与Triton性能不足的矛盾；2026年初GitHub活跃度低（仅paper作者维护），相比tilelang/cuTile等Python DSL，优势收窄至：无转换链路、C++生态兼容、NCU精准调试；仍推荐作为学习对象或纯C++项目选择。 — [[2026-01-13-深入解读thunderkittens-兼顾cutlass性能与tilelang易]]
