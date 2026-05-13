---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: entity
refs: 4
tier: active
---

# Blackwell

NVIDIA's 2024 GPU architecture; B100/B200/B300/GB200; first NVFP4 native silicon.

## Synthesis


NVIDIA's Blackwell generation (B200/B300/GB200/GB300) is the first architecture with native FP4 Tensor Cores, enabling NVFP4 pretraining — a 12B-parameter model trained on 10 trillion tokens in 4-bit floating-point that matches FP8 training loss, the longest 4-bit pretraining run publicly documented. In inference, Blackwell is the primary target for TensorRT-LLM 1.1.0rc1's gpt-oss-120b deployment, with a GB200 NVL72 system delivering over 1.5 million tokens per second system-wide at max-throughput (>20k tps/gpu on 4× GB200 with DP4EP4). It also serves as the hardware baseline for NVIDIA's systematic 100k+ design-point disaggregation study, where DeepSeek-R1 and Llama-3.1-70B/405B are simulated on Blackwell FP4 to map the Pareto frontier between disaggregated and co-located serving. On the software side, CUDA 13.1 introduces two Blackwell-specific platform features: MLOPart (Memory Locality Optimization Partition, presenting one GPU as multiple memory-locality-optimized CUDA devices on compute capability 10.0/10.3 B200/B300 today, with GB200/GB300 planned) and cuBLAS FP32/FP64 Tensor-Core emulation targeting GB200 NVL72 and RTX PRO 6000 Blackwell Server Edition.


## Observations

- Primary target architecture for gpt-oss-120b deployment in TensorRT-LLM 1.1.0rc1 (B200/GB200/H200 hardware). Headline benchmark: **GB200 NVL72 delivers >1.5M tps system-wide** at max-throughput. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- Used as the hardware baseline for the disaggregation systematic study's 100k+ design-point sweep — DeepSeek-R1 / Llama-3.1-70B/405B simulated on Blackwell + FP4 precision. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- CUDA 13.1 introduces Blackwell-specific platform features: **MLOPart** (Memory Locality Optimization Partition; compute capability 10.0/10.3 on B200/B300 today, GB200/GB300 planned) presents one underlying GPU as multiple memory-locality-optimized CUDA devices. cuBLAS FP32/FP64 Tensor-Core emulation targets GB200 + RTX PRO 6000. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- The native-FP4 platform that NVFP4 pretraining validates — Blackwell's FP4 Tensor Cores enable the 4-bit training path matching FP8 quality at 12B/10T-token scale. — [[2026-02-04-pretraining-large-language-models-with-n]]
