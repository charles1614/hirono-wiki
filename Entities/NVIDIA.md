---
created: 2026-05-11
updated: 2026-05-11
synthesis_updated_at: 2026-05-12
type: entity
refs: 6
tier: active
---

# NVIDIA

Dominant ML accelerator vendor; CUDA platform owner; GPU architectures: Ampere → Ada → Hopper → Blackwell.

## Synthesis

Dominant ML-accelerator vendor whose 2025-26 strategic posture spans **(a) GPU hardware** through Blackwell (B200/GB200/B300) with native FP4/FP8 Tensor Cores; **(b) the CUDA platform** including the CUDA 13.1 introduction of CUDA Tile programming as the largest update "since CUDA was invented"; **(c) inference stacks** anchored by TensorRT-LLM (with the official gpt-oss-120b deployment recipe on Blackwell); **(d) training infrastructure** via Megatron-Core (MoE Parallel Folding 49.3% MFU on Mixtral 8×22B); **(e) systematic-study publications** (89-author NVFP4 pretraining paper, 18-author Beyond-the-Buzz disaggregation study) that anchor the technical narrative for Blackwell-era silicon. Competitive position is being framed against TPU (1.2-1.7× perf at 53-77% power, per Google's IntuitionLabs analysis); NVIDIA's counter is the NVFP4-doubles-effective-throughput-on-Blackwell story.

## Observations

- Authors the first systematic disaggregation study at scale ("Beyond the Buzz", 18-author NVIDIA paper, June 2025) — simulates 100k+ design points across DeepSeek-R1 / Llama-3.1-70B/405B on Blackwell-FP4. Key finding: disagg wins are concentrated in prefill-heavy traffic on larger (>10B) models; dynamic rate matching is essential; existing datacenter bandwidth is sufficient for KV cache transfer. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- Ships gpt-oss-120b deployment guidance for Blackwell — official two-mode (low-latency vs max-throughput) recipe in TensorRT-LLM 1.1.0rc1, headline numbers 420 tps/user low-latency on 8× B200 batch 1, 19.5k tps/gpu max-throughput on 4× B200, >20k tps/gpu on GB200, 1.5M tps system-wide on GB200 NVL72. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- MoE Parallel Folding (Dennis Liu et al., 18-author NVIDIA paper, April 2025) is the training-side innovation shipped in Megatron-Core: decouples attention vs MoE parallelism mappings in 5-D hybrid parallelism (TP × EP × CP × DP × PP). 49.3% MFU on Mixtral 8×22B and 39.0% on Qwen2-57B-A14B on H100, scaling to 1,024 GPUs at 128K sequence length. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- CUDA 13.1 (Dec 2025) is positioned as "the largest and most comprehensive update to the CUDA platform since it was invented two decades ago" — introduces CUDA Tile (Tile IR + cuTile Python), runtime green-contexts, MLOPart for Blackwell, FP32/FP64 emulation on Tensor Cores, Nsight Compute 2025.4 Tile profiling. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- Reference comparator in Google's TPU positioning — TPU v4 pods claimed to deliver 1.2-1.7× higher throughput than equivalent A100 pods at 53-77% of the power; Gemini 3 trained entirely on TPU, "marking Google's strategic break from third-party GPU dependence." — [[2026-01-09-google-tpus-explained-architecture-perfo]]
- NVFP4 pretraining paper (89-author NVIDIA paper, Sep 2025 / Mar 2026 v2) is the strategic counter to TPU positioning — first publicly documented 12B-parameter LLM pretrained on 10 trillion tokens in 4-bit precision (NVFP4), matching FP8 training loss + downstream accuracy. Four-ingredient method: Random Hadamard transforms + 2D quantization + stochastic rounding + selective high-precision layers. — [[2026-02-04-pretraining-large-language-models-with-n]]
