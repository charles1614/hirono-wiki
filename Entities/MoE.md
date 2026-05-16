---
created: 2026-05-11
updated: 2026-05-16
type: entity
refs: 45
tier: active
---

# MoE

Mixture-of-Experts; sparse-activation architecture; current frontier-model default (DeepSeek-V3, GPT-OSS, GLM-4.6, Mixtral).

## Synthesis

*Regenerated from Observations below.*

## Observations

- **Shared Experts Fusion** for models with a single shared expert (e.g., GLM-4.7): merging the shared expert into the routed MoE structure — selecting top-(k+1) of (N+1) experts rather than top-k routed + shared-separately — eliminates a second dispatch and produces substantial SM utilization gains when the intermediate size is small under TP+FP8 configurations. — [[2026-01-26-optimizing-glm4-moe-for-production-65-fa]]
- **EPLB (Expert Parallelism Load Balancer) is the dominant single optimization lever at large EP scale**: in SGLang's 96-GPU DeepSeek-V3 deployment, EPLB delivers 1.49× prefill and 2.54× decode speedup over unbalanced EP. EPLB works by allocating 32 redundant experts (288 total from 256) and using them as flexibility budget — replicating hot experts, grouping cold experts together, and enabling non-power-of-2 EP sizes (EP12, EP72). Without EPLB, GPU balancedness (mean/max token count ratio) degrades sharply as EP size grows. — [[2025-09-05-deploying-deepseek-with-pd-disaggregatio]]
- Raschka's 2025–2026 survey documents MoE as the dominant paradigm for frontier models above ~30B parameters. DeepSeek V3's architecture (256 experts, 9 active / 37B of 671B) became the 2025 reference, adopted directly by [[Kimi K2]] and [[Mistral Small]] 3 Large. Shared-expert presence is a live design variable: used in DeepSeek V3, GLM-4.5, Grok 2.5, and Qwen3-Next; dropped in Qwen3 235B-A22B and MiniMax M2. Qwen3 developer noted no significant improvement from shared experts in their setup (8+ routed experts). — [[2026-01-28-the-big-llm-architecture-comparison]]
- **GLM 5与DeepSeek V3.2的MoE配置相同**：独立专家+共享专家，单token仅路由至8个独立专家（top-8路由）。GLM 5（774B总参/40B激活）与DeepSeek V3.2（671B总参/37B激活）的主要差异不在MoE路由方案，而在总参规模与激活参数数量。 — [[2026-03-21-2026大模型架构概览-二-glm-5-dsv3-2]]
- PyTorch Conference 2025 session #74 (Chenyang Zhao, UCLA) addressed long-tail and MoE challenges in reinforcement learning using [[SGLang]], signaling MoE-aware RL serving as an active research/engineering topic. — [[2025-12-14-vllm-project-vllm-in-pytorch-conference-]]
- On [[Blackwell]] B200, grouped GEMM for MoE (GPT-OSS-20B, 32 experts, top-4, [[NVFP4]]) performance is determined almost entirely by kernel engineering: the 3 key knobs are kernel fusion (SGLang reduces 7 vLLM kernels to 5), architecture-specific [[CUTLASS]] schedules for FP4 warp specialization + TMA, and adaptive grid sizing for small-batch SM occupancy. At batch size = 1, the [[SGLang]] vs [[vLLM]] gap is 1.84×. Expert-first layouts ([[FlashInfer]] CuteDSL) amortize preprocessing overhead only at large batch sizes (≥256). — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
- Datawhale/Raschka survey (Jul 2025): MoE is now the dominant paradigm above ~30B parameters. DeepSeek V3 (256 experts, 9 active = 1 shared + 8 routed) became the 2025 reference; Kimi K2 extends this with more experts; Qwen3 235B-A22B drops the shared expert; Llama 4 alternates MoE and dense blocks. Contrary to common belief: all MoE experts must reside in VRAM for fast switching — MoE's VRAM advantage over dense is primarily through quantization, not architecture. — [[2025-07-25-从deepseek-v3到kimi-k2-八种现代-llm-架构大比较]]
- [[RankMixer]]'s per-token SparseMoE (ByteDance, production 2025): gates each token to an independent FFN via ReLU routing (adapts active expert count to information density); DTSI ("Dense Training, Sparse Inference") trains all experts densely to avoid imbalance, applies sparse routing at inference only; deployed at Douyin scale as part of a 70× parameter scaling with flat latency cost. — [[2025-08-02-抖音全新推荐大模型rankmixer-参数翻70倍-推理成本不涨]]
- 大EP部署的前提是足够高的并发需求：MoE最优部署曲线形如浴盆，两端为一体机和大EP，中间因BSP不均衡的二阶放大效应形成深坑；DeepSeek-V3的256专家大EP在足够多并发下接近全负荷，但若专家数扩至1024，需要约4倍以上的V3并发量，此时cold/hot专家分类将成必要机制。 — [[2025-06-04-https-zhuanlan-zhihu-com-p-1911899575096]]
- [[VeOmni]] integrates Expert Parallel (EP) as a composable parallelism primitive alongside FSDP and Ulysses for training super-large MoE-based multi-modal models at thousand-GPU scale. — [[2025-08-06-字节跳动-veomni-框架开源-统一多模态训练效率飞跃]]
- Kimi K2's sparsity scaling law: increasing total MoE params at fixed activated params continues to improve loss without overfitting — holds for both training loss and validation loss; motivated the jump from DSv3's 256 to K2's 384 experts with the same top-8 routing. — [[2025-07-15-https-www-zhihu-com-question-19271405065]]
