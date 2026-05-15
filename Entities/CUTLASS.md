---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 6
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
