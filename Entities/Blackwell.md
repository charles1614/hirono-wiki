---
created: 2026-05-11
updated: 2026-05-11
synthesis_updated_at: 2026-05-12
type: entity
refs: 4
tier: active
---

# Blackwell

NVIDIA's 2024 GPU architecture; B100/B200/B300/GB200; first NVFP4 native silicon.

## Synthesis

NVIDIA's 2024-25 architecture (B100/B200/B300/GB200) — first generation with **native FP4 Tensor Cores**, enabling the NVFP4 pretraining path (12B model on 10T tokens, matching FP8 quality). Production target for **gpt-oss-120b deployment via TensorRT-LLM** (1.5M tps on GB200 NVL72) and the **disaggregation design space** (Beyond-the-Buzz uses Blackwell-FP4 as the hardware baseline for its 100k+ design-point sweep). CUDA 13.1 adds Blackwell-specific features (**MLOPart** memory-locality partitioning on compute capability 10.0/10.3; cuBLAS FP32/FP64 Tensor-Core emulation on GB200 / RTX PRO 6000).

## Observations

- Primary target architecture for gpt-oss-120b deployment in TensorRT-LLM 1.1.0rc1 (B200/GB200/H200 hardware). Headline benchmark: **GB200 NVL72 delivers >1.5M tps system-wide** at max-throughput. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- Used as the hardware baseline for the disaggregation systematic study's 100k+ design-point sweep — DeepSeek-R1 / Llama-3.1-70B/405B simulated on Blackwell + FP4 precision. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- CUDA 13.1 introduces Blackwell-specific platform features: **MLOPart** (Memory Locality Optimization Partition; compute capability 10.0/10.3 on B200/B300 today, GB200/GB300 planned) presents one underlying GPU as multiple memory-locality-optimized CUDA devices. cuBLAS FP32/FP64 Tensor-Core emulation targets GB200 + RTX PRO 6000. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- The native-FP4 platform that NVFP4 pretraining validates — Blackwell's FP4 Tensor Cores enable the 4-bit training path matching FP8 quality at 12B/10T-token scale. — [[2026-02-04-pretraining-large-language-models-with-n]]
