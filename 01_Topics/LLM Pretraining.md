---
created: 2026-05-11
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 18
---

# LLM Pretraining

## What

*Stub topic — to be expanded from sources.*

<!-- merged from `Pretraining` on 2026-05-13 -->

Initial large-scale training of foundation models on diverse text corpora before downstream fine-tuning.

## Current understanding

<!-- TODO: re-synthesize ## Current understanding (post-merge 2026-05-13) -->
The corpus on LLM pretraining is thin compared to the inference-systems surface area, but a coherent picture emerges from several sources that touch the training stack.

**The canonical setup.** LLM pretraining is next-token prediction at massive scale — a transformer (dense or MoE) trained on trillions of tokens using distributed hardware, with quality governed by the Chinchilla-style scaling laws that relate parameters, data, and compute. The [[2026-04-03-llm-architecture-gallery]] makes visible what 2025–26 pretraining targets actually look like: every frontier model above 100B parameters is a Mixture-of-Experts; GQA + RoPE is the dense default; MoE granularity has grown from 8 active experts (Mixtral era) to 128+ routed experts with 8 active. MoE dominates because it decouples parameter count from active compute — you can train a 671B-param model while activating ~37B per token.

**Numerical precision is the current lever.** The sharpest pretraining result in the corpus is [[2026-02-04-pretraining-large-language-models-with-n]], which shows a 12B model trained to 10 trillion tokens in NVFP4 (4-bit floating point, Blackwell-native) matching an FP8 baseline on training loss and downstream tasks. The four-ingredient recipe — Random Hadamard transforms to bound outliers, 2-D quantization for forward/backward consistency, stochastic rounding for unbiased gradients, selective high-precision layers for stability-critical operators — is now the reference template for FP4 training. If FP4 pretraining matches FP8 quality, the next frontier run on Blackwell could double effective arithmetic density per dollar.

**Parallelism for MoE pretraining.** [[2025-10-28-moeparallel-folding-heterogeneous-parall]] (NVIDIA, shipped in Megatron-Core) identifies that attention and MoE layers have fundamentally different compute/comm patterns, so forcing them through the same parallelism config wastes throughput. MoE Parallel Folding decouples the two: attention uses TP × CP × DP × PP; MoE uses TP × EP × DP × PP; only PP must match. This removes the prior constraint that capped EP ≤ DP, enabling deeper Expert Parallelism at 512+ GPU scale. Headline result: 49.3% MFU on Mixtral 8×22B at 1,024 H100 GPUs.

**Communication overlap is mandatory at TP scale.** [[2025-10-09-flux-fast-software-based-communication-o]] (ByteDance/PKU, CUTLASS-based) shows that AllGather/ReduceScatter from tensor parallelism accounts for a substantial runtime fraction in standard 8TP configurations — and that prior stream/event-based overlap methods underperform on GPUs because they split one GEMM into N small GEMMs, starving SMs. Kernel fusion at tile granularity (Flux) hides up to 96% of communication, yielding 1.24× training speedup over Megatron-LM baseline. The published DeepSeek V3/R1 training traces ([[2026-04-03-deepseek-ai-profile-data-analyze-computa]]) make the same principle visible in production: 112 SMs run compute, 20 SMs run communication on disjoint partitions — the SM-lane split is a deployment-level commitment, not kernel-level tuning.

**Data loading is a silent bottleneck.** [[2026-01-20-introducing-spdl-faster-ai-model-trainin]] (Meta Reality Labs) documents that subprocess-based dataloaders (PyTorch DataLoader style) incur multi-GB memory overhead per worker and double-copy every batch. Thread-based loading (SPDL) achieves 2–3× higher throughput in regular CPython and +30% more with Free-Threaded Python (PEP 703/3.13t), because most hot-path C extensions (NumPy, Pillow, IO) already release the GIL. The implication: GPU utilization at training time often has a data-pipeline ceiling that is orthogonal to parallelism tuning.

**Data ordering matters more than data mixing.** The Xiaomi XLA training report ([[2026-04-14-见谈-小米陈龙-把大模型抚养到18岁-再教它如何驾驶]]) is not an LLM-pretraining source per se, but it documents a concrete failure mode that generalizes: mixing all training domains simultaneously degraded both target-domain performance and general capabilities, while sequencing (general multimodal first, then specialized) recovered both. The "first become a person, then learn to drive" anecdote is a practitioner data point for curriculum ordering in multi-domain pretraining — consistent with the broader finding that data mixture schedules affect final model quality as much as total token counts.

**Where the corpus is sparse.** The wiki has no Sources covering tokenization design, data deduplication / quality filtering, learning rate schedules / warmup, optimizer choices (Adam vs Adafactor vs Muon), or context-length extension strategies. The DeepMind "How to Scale Your Model" JAX book (jax-ml.github.io/scaling-book) is flagged in [[2026-04-16-我在-汪志鹏的笔记下发布了一条评论-训练-infra-最好的资料应该就是-dee]] as the best public quantitative treatment of training-cost economics and distributed-parallelism tradeoffs, but has not yet been ingested. Megatron-LM source code is the canonical reference implementation; no Source covers it directly beyond passing mentions.

<!-- merged from `Pretraining` on 2026-05-13 -->

Pretraining is the initial large-scale training phase in which a foundation model learns general representations from a massive, diverse text corpus — typically hundreds of billions to trillions of tokens drawn from web crawls, books, code repositories, and curated datasets. The objective is almost universally next-token prediction (autoregressive language modeling), though masked-language-modeling variants (BERT-style) and mixture objectives have also been used. The central insight is that predicting held-out tokens at scale forces the model to internalize syntax, factual associations, reasoning patterns, and world structure, producing a general-purpose representation that downstream fine-tuning stages can cheaply specialize.

**Data composition and quality filtering** are widely recognized as more impactful than raw compute at a fixed budget. Sources consistently emphasize that deduplication, quality heuristics (perplexity filtering, domain weighting), and deliberate over-sampling of high-signal domains (code, math, scientific text) materially improve downstream task performance — often more than proportional increases in parameter count or training tokens.

**Scaling laws** (Chinchilla and successors) establish that optimal compute allocation requires training tokens to scale roughly linearly with parameter count. Under-trained large models were the norm before Chinchilla; post-Chinchilla practice shifts toward smaller models trained on significantly more tokens, trading inference-time cost for training efficiency. More recent work probes the "overtrained" regime, showing that inference-optimal and training-optimal frontiers diverge: models trained well past the Chinchilla-optimal token count remain practical when inference volume justifies the upfront compute.

**Architecture** is now largely standardized around the decoder-only transformer with rotary positional embeddings, grouped-query attention, and SwiGLU or similar gated activations. Encoder-only and encoder-decoder variants persist in specialized niches but are not the dominant pretraining architecture for general-purpose LLMs.

**Tokenization** choices (vocabulary size, BPE vs. unigram, multilingual coverage) have outsized effects on downstream multilingual and code performance and are increasingly treated as a first-class design decision rather than an afterthought.

No sources are yet attached to this topic. Claims above reflect cross-source consensus visible in the broader literature; they will be refined and attributed as Sources accumulate.

## Observations

- A 163M-parameter GPT-2 small equivalent trained from scratch on a consumer RTX 3090 in ~48 hours reached near-GPT-2-quality, using HuggingFace FineWeb-Edu 10B token sample. Demonstrates that GPT-2-scale base model pretraining is accessible on consumer hardware. — [[2026-02-07-writing-an-llm-from-scratch-part-28-trai]]
- [[Fill-in-the-Middle]] (FIM) 让Decoder-only代码LLM学会双向补全：prefix/middle/suffix三段重构输入，保留全部三段损失；OpenAI消融实验显示引入FIM后左到右生成Perplexity不增反降（"FIM-for-free"）；SPM模式（Suffix-Prefix-Middle）优于PSM，原因可能是注意力位置偏差。 — [[2025-05-27-大模型-fim-预训练任务是什么-feishu-docs]]
- [[Seed-Coder]] 用LLM代替人工规则自动化代码数据评分（1.3B Llama 2回归评分器，[0,1]分），构建6T token预训练语料库（~1T GitHub + 100B Commits + ~1.2T网页）；预训练三阶段（基础1T + 代码强化4T + 长上下文1T），FIM比例0.5→0.1；Reasoning模型用GRPO+DAPO从Base出发分阶段训练。 — [[2025-05-27-seed-coder-feishu-docs]]
- [[GTE-Qwen]] 从[[Qwen]] LLM Base微调为嵌入模型，三核心机制：推理时设 `is_causal=False` 启用双向注意力、额外Instruction Tuning、改进InfoNCE损失（4项分母含反向对比，τ=0.01）；token表示取序列最后一个真实token的embedding；gte-Qwen2-7B-instruct曾登顶MTEB排行榜第一。 — [[2025-05-27-gte-qwen系列-feishu-docs]]

## Open threads


## Sources drawn on

- (auto-populated by reindex)

<!-- merged from `Pretraining` on 2026-05-13 -->

- [[2025-07-23-karpathy-nn-zero-to-hero-neural-networks]] — Pedagogical pretraining walkthrough: micrograd → makemore MLP → BatchNorm → GPT from scratch; covers BPE tokenization as a separate stage.
- [[2025-07-06-rasbt-llms-from-scratch-implement-a-chat]] — From-scratch GPT pretraining via PyTorch; bonus chapters add Qwen3/Gemma3/Llama3.2 from scratch, LoRA, and DPO finetuning.

