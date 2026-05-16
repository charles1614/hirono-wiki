---
created: 2026-05-11
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 23
tier: active
---

# CUTLASS

NVIDIA's CUDA C++ templates for high-performance matmul/conv; building blocks for cuBLAS + custom kernels.

## Synthesis


NVIDIA's CUDA C++ template library for high-performance matrix multiplication and convolution, CUTLASS serves as the substrate for multiple frontier kernel projects. Flux (ByteDance/PKU) is built directly on CUTLASS — its auto-tunable, fine-grained kernel-fusion of compute and communication tiles into a single thread block is modular across GPU generations and interconnects, and CUTLASS was chosen over Triton specifically because Tensor-Core-heavy auto-tunable kernels are better suited to it. FlashMLA acknowledges CUTLASS as one of its primary inspirations alongside FlashAttention's online softmax and Flash-Decoding's split-K, crediting its kernel-fusion and tile-level scheduling primitives. At the deployment layer, TensorRT-LLM's max-throughput configuration for gpt-oss-120b on B200/GB200 uses the CUTLASS MoE backend, but with an architectural constraint: CUTLASS supports only pure expert parallelism (no mixed TP/EP), which forces max-throughput deployments to set `--ep ${num_gpus}` while the TRTLLM backend retains mixed TP/EP flexibility for low-latency configurations.


## Observations

- gpt-oss-120b max-throughput configuration on TensorRT-LLM 1.1.0rc1 uses **CUTLASS MoE backend** (B200/GB200 path). Architectural constraint: **CUTLASS supports only pure EP** (no mixed TP/EP), so max-throughput requires `--ep ${num_gpus}` while the low-latency TRTLLM backend retains mixed TP/EP flexibility. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- The substrate Flux is built on — auto-tunable fine-grained kernel-fusion of compute + comm tiles into a single thread-block per tile pair. Modular per-architecture tuning across A100/H800 + PCIe/NVLink. ByteDance's choice over Triton for Tensor-Core-heavy auto-tunable kernels. — [[2025-10-09-flux-fast-software-based-communication-o]]
- FlashMLA acknowledges CUTLASS as one of its primary inspirations alongside FlashAttention (online softmax) and Flash-Decoding (split-K) — kernel-fusion and tile-level scheduling primitives. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- SemiAnalysis Tensor Core Evolution 引用 CUTLASS visualizer 生成的 Volta/Ampere MMA 数据布局图（quadpair 和 warp-wide layout 的 thread-data 映射），并引用 Programming Tensor Cores with CUTLASS（GTC 2019）作为 Volta 交错布局的规范文档来源。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- A CUTLASS MLA attention hang in vLLM was traced via `cuda-gdb` + `nvdisasm -ndf -c -gi` inline chain analysis; the root cause was a bug in upstream CUTLASS example code, fixed in CUTLASS v4.3.0 (vLLM PR #26026). `cuda-gdb` only surfaces the last inline frame; `nvdisasm` exposes the full multi-level CUTLASS call chain. — [[2025-12-04-从gpu卡死到精准锁定出错代码-vllm-cuda-调试实战技巧]]
- ThunderKittens技术解读将CUTLASS定位为高性能但嵌套模板复杂、编译体积大、开发门槛高的一极；MindGPT 3.0的LisaRT推理引擎基于CUTLASS定制GroupedGemm kernel实现MoE算子，性能提升2.8倍。 — [[2026-01-13-深入解读thunderkittens-兼顾cutlass性能与tilelang易]]
- Blackwell-native FP4 MoE schedule `KernelPtrArrayTmaWarpSpecialized1SmNvf4Sm100` (used by [[SGLang]]) provides: FP4 warp specialization (separate warp roles for load, dequantize, accumulate), TMA async loads with 128-byte alignment enforcement via padding, and 1-SM expert grouping. Generic CUTLASS 3.x (used by [[vLLM]]) skips alignment enforcement and misses FP4 warp specialization on `sm_100a`, resulting in 142 TFLOPS lower peak throughput. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
- CUTLASS UMMA interface for Blackwell: `SM100_MMA_F16BF16_SS` atom with template params for M, N, major ordering, negation; ThrID is `Layout<_1>` (CTA peer layout, not thread layout); `make_tmem_copy` with `SM100_TMEM_LOAD_32dp32b1x` extracts [[Tensor Memory]] accumulator to registers (hardcoded 4 warps/warpgroup); `cute::TMEM::Allocator1Sm` wraps `tcgen05.alloc`/`tcgen05.dealloc` for TMEM management. — [[2025-06-09-一起聊聊nvidia-blackwell-新特性之umma]]
