---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 8
---

# LLM Pretraining

## What

*Stub topic — to be expanded from sources.*

## Current understanding

The corpus on LLM pretraining is thin compared to the inference-systems surface area, but a coherent picture emerges from several sources that touch the training stack.

**The canonical setup.** LLM pretraining is next-token prediction at massive scale — a transformer (dense or MoE) trained on trillions of tokens using distributed hardware, with quality governed by the Chinchilla-style scaling laws that relate parameters, data, and compute. The [[2026-04-03-llm-architecture-gallery]] makes visible what 2025–26 pretraining targets actually look like: every frontier model above 100B parameters is a Mixture-of-Experts; GQA + RoPE is the dense default; MoE granularity has grown from 8 active experts (Mixtral era) to 128+ routed experts with 8 active. MoE dominates because it decouples parameter count from active compute — you can train a 671B-param model while activating ~37B per token.

**Numerical precision is the current lever.** The sharpest pretraining result in the corpus is [[2026-02-04-pretraining-large-language-models-with-n]], which shows a 12B model trained to 10 trillion tokens in NVFP4 (4-bit floating point, Blackwell-native) matching an FP8 baseline on training loss and downstream tasks. The four-ingredient recipe — Random Hadamard transforms to bound outliers, 2-D quantization for forward/backward consistency, stochastic rounding for unbiased gradients, selective high-precision layers for stability-critical operators — is now the reference template for FP4 training. If FP4 pretraining matches FP8 quality, the next frontier run on Blackwell could double effective arithmetic density per dollar.

**Parallelism for MoE pretraining.** [[2025-10-28-moeparallel-folding-heterogeneous-parall]] (NVIDIA, shipped in Megatron-Core) identifies that attention and MoE layers have fundamentally different compute/comm patterns, so forcing them through the same parallelism config wastes throughput. MoE Parallel Folding decouples the two: attention uses TP × CP × DP × PP; MoE uses TP × EP × DP × PP; only PP must match. This removes the prior constraint that capped EP ≤ DP, enabling deeper Expert Parallelism at 512+ GPU scale. Headline result: 49.3% MFU on Mixtral 8×22B at 1,024 H100 GPUs.

**Communication overlap is mandatory at TP scale.** [[2025-10-09-flux-fast-software-based-communication-o]] (ByteDance/PKU, CUTLASS-based) shows that AllGather/ReduceScatter from tensor parallelism accounts for a substantial runtime fraction in standard 8TP configurations — and that prior stream/event-based overlap methods underperform on GPUs because they split one GEMM into N small GEMMs, starving SMs. Kernel fusion at tile granularity (Flux) hides up to 96% of communication, yielding 1.24× training speedup over Megatron-LM baseline. The published DeepSeek V3/R1 training traces ([[2026-04-03-deepseek-ai-profile-data-analyze-computa]]) make the same principle visible in production: 112 SMs run compute, 20 SMs run communication on disjoint partitions — the SM-lane split is a deployment-level commitment, not kernel-level tuning.

**Data loading is a silent bottleneck.** [[2026-01-20-introducing-spdl-faster-ai-model-trainin]] (Meta Reality Labs) documents that subprocess-based dataloaders (PyTorch DataLoader style) incur multi-GB memory overhead per worker and double-copy every batch. Thread-based loading (SPDL) achieves 2–3× higher throughput in regular CPython and +30% more with Free-Threaded Python (PEP 703/3.13t), because most hot-path C extensions (NumPy, Pillow, IO) already release the GIL. The implication: GPU utilization at training time often has a data-pipeline ceiling that is orthogonal to parallelism tuning.

**Data ordering matters more than data mixing.** The Xiaomi XLA training report ([[2026-04-14-见谈-小米陈龙-把大模型抚养到18岁-再教它如何驾驶]]) is not an LLM-pretraining source per se, but it documents a concrete failure mode that generalizes: mixing all training domains simultaneously degraded both target-domain performance and general capabilities, while sequencing (general multimodal first, then specialized) recovered both. The "first become a person, then learn to drive" anecdote is a practitioner data point for curriculum ordering in multi-domain pretraining — consistent with the broader finding that data mixture schedules affect final model quality as much as total token counts.

**Where the corpus is sparse.** The wiki has no Sources covering tokenization design, data deduplication / quality filtering, learning rate schedules / warmup, optimizer choices (Adam vs Adafactor vs Muon), or context-length extension strategies. The DeepMind "How to Scale Your Model" JAX book (jax-ml.github.io/scaling-book) is flagged in [[2026-04-16-我在-汪志鹏的笔记下发布了一条评论-训练-infra-最好的资料应该就是-dee]] as the best public quantitative treatment of training-cost economics and distributed-parallelism tradeoffs, but has not yet been ingested. Megatron-LM source code is the canonical reference implementation; no Source covers it directly beyond passing mentions.

## Open threads


## Sources drawn on

- (auto-populated by reindex)
