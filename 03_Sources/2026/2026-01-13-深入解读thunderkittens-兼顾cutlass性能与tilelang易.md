---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/f5zPTe_G2QvGub1ZVTv3DA
tags: [attention-kernels, gpu, tooling]
---

# [2026-01-12] 深入解读ThunderKittens：兼顾cutlass性能与Tilelang易用性的C++模板库

## TL;DR

以2026年视角回顾ThunderKittens（2024年10月诞生于斯坦福HazyResearch），这是一个介于CUTLASS高性能与Triton易用性之间的C++模板库，提供三级（warp/block/grid）硬件对应抽象和PyTorch风格API；文章认为随着Tilelang/cuTile等Python DSL的成熟，TK的竞争优势有所收窄，但仍是优秀的学习对象和纯C++项目的选择。

## Key claims

- ThunderKittens核心动机：解决CUTLASS高性能但嵌套模板复杂 vs. Triton易用但性能不足的矛盾，以及FlashAttention-2在H100上性能下降47%、FA-3耗时两年适配H100的硬件迭代鸿沟。
- 三级抽象对应GPU硬件层级：warp级（16×16基础Tile、Reg/Smem/Gmem Tile抽象、PyTorch风格API、3种shared memory swizzle layout编译时自动选择）、block级（Load-Compute-Store-Finish四步模板，屏蔽warp间异步同步编排）、grid级（threadblock swizzle解决L2 cache命中率低、persistent grid+streamK解决wave quantization）。
- 模板化设计使type check/layout check在编译期完成，避免运行时开销；与Python DSL相比TK无Python→C++→CUDA转换链路，NCU精准定位性能瓶颈，纯C++生态兼容性强。
- 局限性：截至2026年初GitHub更新频率低（仅paper作者维护）；相比tilelang/cuTile的PyTorch风格FlashAttention实现，TK代码量仍更多；TVM-FFI支持后Python DSL运行时开销已大幅降低，定制化支持也在追赶。
- 文章附完整TK FlashAttention前向实现代码（含producer/consumer分离、TMA异步加载、在线softmax），展示了Load-Compute-Store-Finish模板的实际使用方式。

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2026-01-13-深入解读thunderkittens-兼顾cutlass性能与tilelang易/weixin-img-003.png)
![](../../raw/raindrop/mp.weixin.qq.com/2026-01-13-深入解读thunderkittens-兼顾cutlass性能与tilelang易/weixin-img-004.png)

*Other images decorative — API screenshot redundant with body text.*

## What this changes

为想在CUTLASS和Python DSL之间寻找中间路线的开发者提供了TK的技术横评，特别是对学习GPU kernel编程有价值的路线建议。

## Entities touched

[[ThunderKittens]], [[CUTLASS]], [[FlashAttention]]

## Topics touched

[[Attention Kernels]], [[Kernel Authoring Languages]]

## Raw source

[mp.weixin.qq.com/s/f5zPTe_G2QvGub1ZVTv3DA](https://mp.weixin.qq.com/s/f5zPTe_G2QvGub1ZVTv3DA) — WeChat公众号 AI不止算法，2026-01-12. Read 2026-05-15.
