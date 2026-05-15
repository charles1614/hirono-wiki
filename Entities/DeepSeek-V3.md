---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 18
tier: active
---

# DeepSeek-V3

DeepSeek's third-generation dense Transformer model, powering V3.1 and V3.2 variants

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- DeepSeek-V3.1 采用 UE8M0 FP8（MXFP8 变种，无符号 8 位指数缩放因子）：梯度溢出率降低 99.7%，训练速度提升 3.15×；是专为即将发布的下一代国产芯片设计的技术方案。 — [[2025-08-28-深度解析-deepseek为什么要推ue8m0-fp8]]
- FlashMLA is purpose-built for DeepSeek-V3 series inference: 128 query heads (MQA mode, h_kv=1), d_qk=576 (512 NoPE + 64 RoPE), d_v=512, page block size=64 tokens; these parameters determine the V32 FP8 KVCache format (656 bytes/token) and place MLA decoding in compute-bound territory on H800 (ratio ≈ 256 flops/byte vs. ~258 crossover). Powers V3, V3.1, V3.2 inference. — [[2026-01-27-deepwiki-flashmla-01-overview]]
- At scaled-down DeepSeek-V3 architecture (256 experts, top-8, hidden=2560) on a single [[Blackwell]] B200, the performance gap between [[SGLang]] and [[vLLM]] narrows at large batch sizes because higher natural parallelism (256×8=2048 token slots at batch=1) better saturates all SMs regardless of launch heuristic; the small-batch advantage for SGLang persists but is less pronounced than with 32-expert architectures. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
- Architecture: 671B total params, 37B activated/token; 61 layers (58 MoE + 3 dense); 257 experts/MoE layer (256 routed + 1 shared); 9 experts activated per token; d_model=7168; MLA with d_c=512 compressed KV; total BF16 VRAM = 1,342 GB on 32 H20 GPUs (3,072 GB available). — [[2025-08-20-ai-fundermentals-inference-solution-deep]]
- Tencent Taiji team record: 15,800+ tokens/s on 16×H20-96G using PD separation + large EP + w4a8c8 quantization + multi-layer MTP + EPLB expert load balancing; EP communication overhead cut 60% via TRMT library; EP imbalance ratio reduced to 1.2–1.5 with EPLB+redundant experts. — [[2025-08-18-腾讯太极团队实现deepseek模型业内h20最高性能15800-tokens-]]
- Datawhale/Raschka survey (Jul 2025): DeepSeek V3's MLA compresses K/V tensors to a low-dimensional latent before writing to KV cache, reducing memory vs MHA/GQA (despite extra matrix multiplications at runtime); MoE uses 256 experts, 9 active per token (1 shared + 8 router-selected). Kimi K2 and Llama 4 both derived from V3's blueprint with modifications. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- Alibaba [[RTP-LLM]] reproduced DeepSeek-V3 inference on Alibaba Cloud RoCE: Prefill 42.6K TPS/node and Decode 14.7K TPS/node at 4K/2K I/O constraints; 272 GPUs (PD-disaggregated, EP=32 Prefill + EP=144 Decode); key techniques: [[DeepEP]] integration, MTP speculative decoding, MicroBatch overlap, Kernel Fusion (Rotary Embedding transpose + Quantization+Transpose fused), PDL on Hopper for GEMM+Quantization overlap. — [[2025-10-09-如何重现-deepseek-推理性能突破]]

- DeepSeek-V3.2-Exp Latent Cache (656 bytes/token) has high temporal locality both intra- and inter-layer (measured on LongBench-v2); Baidu AIAK ESS offloads Latent Cache to CPU pinned memory using FlashTrans (UVA-based CUDA operator: 37 GB/s H2D, 43 GB/s D2H vs. 0.79/0.23 GB/s for `cudaMemcpyAsync` on scatter accesses). At 128K context with Sparse Memory Ratio 0.1, ESS achieves 123% throughput improvement. — [[2025-12-04-突破显存瓶颈-基于-deepseek-v3-2-exp-的-latent-cac]]
