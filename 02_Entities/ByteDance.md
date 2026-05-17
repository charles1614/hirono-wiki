---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 8
tier: active
---

# ByteDance

Chinese tech company; LLM lab (Doubao); large internal training infrastructure; co-authored FLUX kernel-fusion paper with PKU.

## Synthesis



ByteDance's AI Infra portfolio spans training, inference, multi-modal, and recommendation: VeOmni (open-sourced August 2025) is a unified multi-modal training framework for LLM/VLM/DiT jointly developed by the Seed team, Volcano Engine ML Platform, and IaaS, used internally to train UI-Tars 1.5 with 40%+ throughput gains over OSS on Wan 2.1-14B LoRA; RankMixer-1B deployed on the Douyin main feed achieves 70× dense parameter scaling (16M → 1B) with flat inference latency via GPU-aligned TokenMixing + per-token SparseMoE and 10× MFU improvement to 40%+ (arXiv 2507.15551). ByteCheckpoint (NSDI'25) is the production checkpointing system for large-scale LFM training, using parallelism-agnostic ShardMeta (fqn, nD_offsets, nD_lengths) for automatic load-time resharding, supporting Megatron-LM/FSDP/DDP/veScale and HDFS/NAS/local storage, achieving 54.20× checkpoint-stall reduction and deployed on tens of thousands of GPUs across pre-training and post-training. Seed-Coder is an 8B open-source code LLM family (Base/Instruct/Reasoning) that replaces human rules with a 1.3B Llama-2 regression scorer to construct a 6T-token corpus, with the Reasoning model trained from Base via GRPO+DAPO under verl. ByteDance also released the Flux paper (with PKU) on CUTLASS-based kernel-fusion communication overlap (1.24× over Megatron-LM, 1.66× prefill / 1.30× decode over vLLM) and announced the veRoCE RDMA protocol at Force大会 December 2025, with NVIDIA, AMD, Broadcom, 云脉芯联, and 比特智路 as hardware verification partners.



## Observations

- Open-sourced [[VeOmni]] (Aug 2025): unified multi-modal training framework for LLM/VLM/DiT, developed jointly by Seed team + Volcano Engine ML Platform + IaaS; used internally to train UI-Tars 1.5; 40%+ throughput gains over OSS on [[Wan 2.1]]-14B LoRA. — [[2025-08-06-字节跳动-veomni-框架开源-统一多模态训练效率飞跃]]
- [[RankMixer]]-1B deployed on Douyin main feed (2025): 70× dense parameter scaling (16M → 1B) with flat inference latency via GPU-aligned TokenMixing + per-token SparseMoE; MFU 10× improvement to 40%+. arXiv 2507.15551. — [[2025-08-02-抖音全新推荐大模型rankmixer-参数翻70倍-推理成本不涨]]
- [[Seed-Coder]] 是[[ByteDance]]开源的8B代码LLM家族（Base/Instruct/Reasoning），用LLM（1.3B Llama 2回归评分器）代替人工规则自动化评分代码数据，构建6T token语料库；Reasoning模型从Base出发，使用GRPO+DAPO（verl框架）进行LongCoT强化学习训练。 — [[2025-05-27-seed-coder-feishu-docs]]
- [[ByteCheckpoint]] (NSDI'25) is ByteDance's production checkpointing system for large-scale LFM training: uses parallelism-agnostic ShardMeta (fqn, nD_offsets, nD_lengths) for automatic load-time resharding, supports Megatron-LM/FSDP/DDP/veScale and HDFS/NAS/local storage, achieves 54.20× checkpoint stall reduction; deployed on tens of thousands of GPUs across pre-training and post-training jobs. — [[2025-03-06-2407-20143]]
