---
created: 2026-05-11
updated: 2026-05-11
synthesis_updated_at: 2026-05-12
type: entity
refs: 3
tier: active
---

# CUTLASS

NVIDIA's CUDA C++ templates for high-performance matmul/conv; building blocks for cuBLAS + custom kernels.

## Synthesis

NVIDIA's CUDA C++ template library for high-performance matmul/conv — the substrate for **Flux's fine-grained kernel-fusion comm overlap** (ByteDance's choice over Triton for TC-heavy auto-tunable kernels) and one of the named inspirations for **FlashMLA's seesaw schedule** (alongside FlashAttention's online softmax + Flash-Decoding's split-K). At the deployment layer, **gpt-oss-120b max-throughput** on TensorRT-LLM uses the **CUTLASS MoE backend** — with the architectural constraint that CUTLASS only supports pure EP (no mixed TP/EP), forcing `--ep ${num_gpus}` on max-throughput configurations.

## Observations

- gpt-oss-120b max-throughput configuration on TensorRT-LLM 1.1.0rc1 uses **CUTLASS MoE backend** (B200/GB200 path). Architectural constraint: **CUTLASS supports only pure EP** (no mixed TP/EP), so max-throughput requires `--ep ${num_gpus}` while the low-latency TRTLLM backend retains mixed TP/EP flexibility. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- The substrate Flux is built on — auto-tunable fine-grained kernel-fusion of compute + comm tiles into a single thread-block per tile pair. Modular per-architecture tuning across A100/H800 + PCIe/NVLink. ByteDance's choice over Triton for Tensor-Core-heavy auto-tunable kernels. — [[2025-10-09-flux-fast-software-based-communication-o]]
- FlashMLA acknowledges CUTLASS as one of its primary inspirations alongside FlashAttention (online softmax) and Flash-Decoding (split-K) — kernel-fusion and tile-level scheduling primitives. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
