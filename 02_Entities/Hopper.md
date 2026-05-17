---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 23
tier: active
---

# Hopper

NVIDIA's 2022 GPU architecture; H100/H200/H800/GH200; introduced WGMMA, TMA, FP8.

## Synthesis




NVIDIA's Hopper architecture (H100/H200/H800/GH200) introduced four micro-architectural capabilities that define its kernel-authoring surface: TMA (block-level async copy between global and shared memory), DSM (direct SM-to-SM loads, stores, and atomics via thread-block clusters), DPX (hardware-accelerated dynamic-programming primitives), and native FP8 Tensor Cores — with the HKUST + HIT microbenchmark study providing the canonical instruction-level characterization. Transformer Engine's FP8 path has documented practical limits: Softmax and GeLU remain unquantized, and `DotProductAttention` bypasses FP8 Tensor Cores in favor of FlashAttention, so real LLM speedups fall short of tensor-core peak rates. Hopper's SM register budget (65,536 32-bit registers) imposes a hard scheduling constraint: the 64×512 WGMMA output matrix occupies 32,768 registers — half the register file — preventing FA-3's two-output ping-pong and forcing FlashMLA's seesaw schedule which splits the output vertically into O_L/O_R across two warpgroups and achieves ~80% Tensor Core utilization and 3 TB/s on H800 SXM5. CUDA 13.1 adds static SM partitioning for MPS in 8-SM chunks on Hopper-and-later discrete GPUs, and FA-V3 explicitly requires TMA for async producer warpgroup data load and WGMMA with independently configurable producer/consumer register allocation. On deployment, H200 carries a backend constraint: TensorRT-LLM's TRTLLM MoE backend doesn't support Hopper, so gpt-oss-120b on H200 must use the TRITON backend, with CUTLASS support on Hopper still ongoing. Hopper FP8 `wgmma` also has a hidden quirk — the accumulator is effectively 22-bit fixed-point, not true FP32, requiring periodic CUDA-core spill to avoid precision loss.




## Observations

- gpt-oss-120b deployment on H200 has a peculiar constraint: TensorRT-LLM's `TRTLLM` MoE backend is not supported on Hopper, so H200 must use `moe_config.backend: TRITON` (OpenAI's Triton kernels, shipped in the NGC container). CUTLASS support on Hopper is "still ongoing". — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- CUDA 13.1's static-SM-partitioning mode for MPS uses **8-SM chunks** as the partition unit on Hopper+ discrete GPUs. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- HKUST + HIT instruction-level study (arXiv:2402.13499, Feb 2024) — the canonical Hopper microbenchmark reference. Three Hopper-novel features benchmarked for the first time: **TMA** (block-level async copy), **DSM** (SM-to-SM atomics), **DPX** (dynamic-programming HW). FP8 Tensor Cores are the qualitative LLM-acceleration jump. Practical TE limits exposed: Softmax/GeLU not FP8-quantized, DotProductAttention bypasses FP8 TC for FlashAttention. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- FlashMLA's **seesaw kernel scheduling** is a direct consequence of the Hopper SM register budget: each 64×512 output matrix occupies 32,768 32-bit registers (half the 65,536-register file), so only one output per SM is possible — preventing FlashAttention-3's two-output ping-pong design. Solution: vertically split output into O_L/O_R and rotate between two warpgroups on alternating KV blocks. Achieves ~80% Tensor Core utilization, 3 TB/s bandwidth on H800 SXM5. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- DSM (Distributed Shared Memory) is the mechanism behind [[FlashMLA]]'s crossover technique for FP8 decode: two CTAs in a cluster each load and dequantize half the KV, then `st.async` to each other's shared memory, synchronized via cluster transaction barrier. Result: 64% dequantization throughput improvement (250→410 TFlops). Dequantization is a Hopper-specific concern because H800 lacks native FP8→BF16 cast, requiring 4-step type conversion pipeline. — [[2026-01-30-deepwiki-flashmla-04-memory-management]]
- TMA (Tensor Memory Accelerator) used by [[FlashMLA]] for fine-grained pipelining: each 64×576 K-block is split into 9 TMA copies (each 64×64), allowing GEMMs to begin as each copy completes. `EVICT_FIRST` cache hint tells L2 to de-prioritize KV data (accessed once per token generation). TMA pipelining is also available as a general-purpose copy-compute overlap primitive for any Hopper kernel dealing with large data tiles. — [[2026-01-30-deepwiki-flashmla-04-memory-management]]
- Hopper（4th gen TC，`wgmma`）新增 Thread Block Cluster（GPC 粒度），允许 Distributed Shared Memory SM-to-SM 直接访问；FP8 TC 累加路径实为 22-bit 定点（非真 FP32），每 N_c 次需溢出到 CUDA core；INT4 自 Hopper 起废弃；后续 Blackwell Ultra INT8 吞吐也有下降——均源于整数精度数据类型普及滞后于硬件设计周期。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- [[DeepEP]] low-latency kernel uses Hopper-specific PTX `ld.global.nc.L1::no_allocate.L2::256B` (non-coherent cache, no-L1-allocate) for volatile reads that would otherwise require NVCC-unsupported intrinsics; works correctly on Hopper because nc and L1 are unified there (no dirty L1 issue); disabled via `DISABLE_AGGRESSIVE_PTX_INSTRS=1` for portability. — [[2025-10-09-deepseek-deepep源码分析]]
- FlashAttention-V3 is explicitly a Hopper-native rewrite of FA-V2: requires TMA for async data loading and WGMMA for matmul; register allocation per warpgroup (producer vs consumer) is independently configurable on Hopper (unlike Ampere), enabling producer warpgroups to relinquish registers to consumer warpgroups for better latency hiding. — [[2025-05-26-flashattention-v3解读之hopper-gpu版flashatte]]
