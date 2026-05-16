---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/ZUJbN_7PJBGfWc2_RRtG2Q
tags: [inference, gpu, training]
---

# [2025-05-25] PyTorch, Triton与runtime的三角虐恋

## TL;DR

深入比较PyTorch和Triton如何分别调用NVIDIA CUDA Runtime和Driver API，梳理从Python层到C++层的完整调用链，帮助开发者理解并与NVIDIA生态接口对齐。

## Key claims

- [[PyTorch]] 通过 `torch._C` 扩展模块调用 CUDA Runtime API，采用延迟初始化策略（`_lazy_init`），首次使用CUDA时才真正初始化驱动；核心API包括 `cudaSetDevice`、`cudaMalloc`、`cudaLaunchKernel`、`cudaDeviceSynchronize` 等。
- [[OpenAI Triton]] 的 `GPUDriver` 类复用PyTorch的CUDA API（`torch.cuda.get_device_capability`、`torch.cuda.set_device`）进行设备管理，通过JIT编译器将Python kernel编译为PTX/ELF，再通过CUDA Runtime加载和launch。
- Triton的 `jit.py` 中 `JITFunction.run()` 获取当前stream后调用 `kernel.run()`，最终通过CUDA API执行 `cudaLaunchKernel`；编译阶段由 `build.py` 调用外部编译器（如nvcc/clang）通过subprocess生成CUBIN。
- Runtime层次：Runtime负责资源管理/进程管理/信息交互；Driver完成向OS注册和中断响应；Firmware负责硬件配置。三者分工明确，上层框架对齐NVIDIA接口可减少生态兼容摩擦。
- Triton的自动调优（`autotuner.py`）通过多次kernel launch计时，基于CUDA events或PyTorch benchmark工具评测不同tile配置下的性能。

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[PyTorch]], [[OpenAI Triton]], [[CUDA]]

## Topics touched

[[GPU Programming Models]]

## Raw source

[mp.weixin.qq.com/s/ZUJbN_7PJBGfWc2_RRtG2Q](https://mp.weixin.qq.com/s/ZUJbN_7PJBGfWc2_RRtG2Q) — 微信公众号"月亮动物园"，2025-05-25. Read 2026-05-16.
