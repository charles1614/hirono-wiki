---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 34
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

- 以DeepSeek V3（MoE+MLA架构）为例的NPU profiling实战：Huawei Ascend Insight工具显示MoE与MLA层间存在大段to/iterm流同步等待时序（区别于GPU场景），AllReduce拆解为ReduceScatter+AllGather并后移后通信计算掩盖改善可通过时序图直接验证，micro batch双流运算的OverlapAnalysis反映重叠度数值变化。 — [[2025-09-10-gpu-npu推理profiling阅读引导-下]]
- DeepSeek-V3.2-Exp Latent Cache (656 bytes/token) has high temporal locality both intra- and inter-layer (measured on LongBench-v2); Baidu AIAK ESS offloads Latent Cache to CPU pinned memory using FlashTrans (UVA-based CUDA operator: 37 GB/s H2D, 43 GB/s D2H vs. 0.79/0.23 GB/s for `cudaMemcpyAsync` on scatter accesses). At 128K context with Sparse Memory Ratio 0.1, ESS achieves 123% throughput improvement. — [[2025-12-04-突破显存瓶颈-基于-deepseek-v3-2-exp-的-latent-cac]]
- DeepSeek-V3（256 expert，每次激活8个）的大EP部署在当前并发规模下处于效率甜点；但若专家数扩至1024，所需并发量需比V3高4倍以上才能让所有expert均衡满负荷，大EP的可扩展性将到达边界；Scale-Up（NVLink域）是保障单用户高token/s的必要路径，Scale-Out无法达到同等低延迟。 — [[2025-06-04-https-zhuanlan-zhihu-com-p-1911899575096]]
- In the KCORES ball-bouncing heptagon benchmark, DeepSeek-V3 scored 68/90 (no friction, no elasticity, no number rotation) and DeepSeek-R1 scored 88/90 (penalized 2 pts for using the `random` library outside the allowed set); DeepSeek-V3-0324 scored 85/90. — [[2025-07-10-kcores-llm-arena-benchmark-ball-bouncing]]
- Moonshot AI inference engineer confirmed that [[Kimi K2]]'s structural differences from DSv3 (more experts, fewer heads, fewer dense layers, no expert grouping) were arrived at after large-scale experiments in which all proposed alternative structures failed to outperform DSv3; DSv3 was kept as the template with only parameter tuning. — [[2025-07-15-https-www-zhihu-com-question-19271405065]]
- DeepSeek-V3 technical report cites [[IBGDA]] for low-latency collective communication; the paper also uses block quantization (128×128 weight blocks, 1×128 activation blocks) for FP8 training, which FA3 adopts for QKV. — [[2025-05-27-浅析deepseek中提到的ibgda]]
- [[SGLang]] distributed communication architecture (source-level): ZMQ IPC for process-level coordination between tokenizer/scheduler/detokenizer, `torch.dist` NCCL for GPU-level TP/DP/EP; [[DP Attention]] for MLA layers avoids KV-cache replication across TP ranks; EP uses [[DeepEP]] / NVSHMEM for low-latency expert dispatch. — [[2025-05-27-sglang-源码学习笔记-三-分布式和并行-以deepseek-为例-wip]]
