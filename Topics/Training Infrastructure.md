---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 18
---

# Training Infrastructure

## What

*Stub topic — to be expanded from sources.*

## Current understanding

No sources have been directly assigned to this topic yet (`source_count: 0`), so the synthesis below is a structural orientation drawn from adjacent populated topics rather than a cross-source consensus built from cited bodies.

**Training infrastructure** refers to the full hardware-software stack that makes large-scale model training feasible: accelerator hardware (GPUs, TPUs, and their interconnects), the distributed-parallelism strategies that partition work across thousands of devices, the communication collectives and networking fabric that bind those devices together, the data-loading pipelines that keep accelerators fed, and the checkpointing and fault-tolerance machinery that protects multi-week runs.

The corpus's coverage of this space currently lives in adjacent topics rather than under this heading. The parallelism dimension — specifically how TP × EP × CP × DP × PP combinations are chosen and composed for MoE models — is addressed in [[LLM Training Systems]], [[MoE Training]], [[Hybrid Parallelism]], and [[Expert Parallelism]]. The data-loading bottleneck (subprocess vs. thread-based workers, per-stage concurrency) is covered in [[Data Loading Pipelines]] and [[Data Loading Pipelines]]. Accelerator hardware characteristics that constrain training choices (FP8 Tensor Core throughput, TMA async copy, NVLink/InfiniBand topology) appear in [[GPU Microarchitecture]] and [[AI Accelerators]]. Numerical-precision tradeoffs that affect training stability and hardware efficiency — FP8 pretraining, FP4 experiments — appear in [[Low-Precision Training]] and [[Numerical Precision]].

The practitioner consensus visible across the corpus's sources is that **hardware utilization (MFU) is the load-bearing metric** for training infrastructure quality. A high-MFU configuration requires matching the parallelism strategy to both the model architecture (dense vs. MoE, attention vs. FFN) and the cluster topology (intra-node NVLink vs. inter-node InfiniBand bandwidth ratios). The corpus's closest anchor source on this topic, a pointer note recommending the DeepMind "How to Scale Your Model" book and NVIDIA Megatron source code, frames it as a top-down cost-model framing (the scaling book) + bottom-up code reading (Megatron) — the two learning modalities that can't be substituted for each other.

A substantive Current understanding here will require ingesting sources that cover training infrastructure directly: the DeepMind/JAX scaling book (`jax-ml.github.io/scaling-book`), Megatron-LM's published design documents, and any corpus sources that touch checkpointing, fault recovery, or cluster topology. Until those are ingested, readers should navigate to [[LLM Training Systems]] and [[Hybrid Parallelism]] for the closest populated content.

## Open threads


## Sources drawn on

- (auto-populated by reindex)

## Observations

- ByteDance veRoCE RDMA protocol targets large-scale GPU cluster training: 128 GPU LLM training speed +11.2% vs RoCEv2, AlltoAll throughput +48.4%, and 95.7% effective throughput at 2% packet loss (vs RoCEv2 communication outage). Core innovations: native multi-path with DDP for out-of-order delivery, SACK-based selective retransmission, per-path congestion control decoupled from reliable transport. — [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]]
- Alibaba Cloud PAI paiMoE + paiFuser cover MoE training and DiT inference infrastructure: paiMoE (Tangram + ChunkFlow) at 3× end-to-end speedup and MFU >61% for Qwen3; paiFuser for DiT reduces 8-GPU parallel video generation time by >80%. Both are production-deployed at Alibaba scale. — [[2025-12-23-大数据-ai-平台-构筑-agentic-ai-的核心基石]]

- [[Meta]] FT-HSDP at 98K GPU scale treats each DP replica (8,192 GPUs) as the fault recovery unit: stall time per failure drops from ~10 min to ~3 min, effective training time improves from ~44% to ~80%. FTAR protocol uses CPU control plane + GPU data plane for cross-DC gradient AllReduce, overlapping with the backward pass. 2PC-style barrier before optimizer step allows intentional replica step-number divergence without degrading model quality. — [[2026-03-01-十万卡保障-meta-ft-hsdp-方案解析]]
- [[xAI]] Colossus 2 launched as the world's first 1 GW training cluster (operational 2026-01-17, Memphis TN); planned upgrade to 1.5 GW by April 2026. — [[2026-01-19-x-上的-elon-musk-the-colossus-2-supercompu]]
- SDC (Silent Data Corruption) causes 1–2 training interruptions per week in frontier clusters; paper arXiv:2502.12340 studies 15 unhealthy vs. 15 healthy nodes. Key findings: gradient noise is small (worst case 5.1% L2 norm), parameter drift is driven more by sharp loss surface geometry than SDC severity, SFT on SDC nodes mostly produces good models but late-stage loss spikes cause catastrophic accuracy collapse. Production incidents: Google Gemini (SDC every 1–2 weeks), Meta LLaMA 3 (6 interruptions / 54 days), ByteDance (8-hour offline stress test to find one faulty node), NVIDIA H100 `mma.sp` bug fixed in driver 535.288.01. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]
- 小鹏汽车"云端模型工厂"（2025年4月披露）：万卡智能算力集群（10 EFLOPS，效率90%+，高峰98%）；Data Infra自主研发使数据上传规模提升22倍、训练数据带宽提升15倍、模型训练速度提升5倍；视频训练数据2000万clips；完整链路（基座预训练→后训练RL→蒸馏→车端部署）平均5天一次迭代。多模态模型训练瓶颈不仅是GPU，还包括数据访问效率（联合优化GPU/CPU/网络I/O）。 — [[2025-12-08-小鹏汽车启动720亿参数自驾基模研发-初步验证自动驾驶规模法则-小鹏汽车官网]]
- Google [[AI Hypercomputer]] image stack (Jan 2026): JAX AI Images (JAII) bundle JAX + LibTPU/CUDA + Flax + Orbax + PyGrain; DLSL images bundle NeMo + PyTorch + Google NCCL gIB plugin per machine series (A4X Max through A3 High); Accelerator OS images ship NVIDIA 570/580 drivers + CUDA 12.2–13.0 for Rocky Linux 8/9 and Ubuntu 22.04/24.04. — [[2026-01-16-os-and-docker-images-ai-hypercomputer-go]]
- [[SimAI]] (Alibaba Cloud, NSDI'25) provides three-level simulation fidelity for LLM training: Analytical (fast), NS-3 packet-level, and Physical (AIOB kernel profiling); supports Megatron/DeepSpeed/DeepSeek parallelism strategies and Vidur-based inference scheduling, enabling topology/bandwidth sensitivity analysis without live cluster allocation. — [[2026-01-06-deepwiki-simai]]
- [[VeOmni]] (ByteDance, Aug 2025): unified multi-modal training framework for LLM/VLM/DiT with composable [[FSDP]]+Ulysses+EP; selective recompute by ROI reduces recompute ratio 60%→30%; achieves 40%+ throughput over OSS baselines on [[Wan 2.1]]-14B LoRA at 720P. — [[2025-08-06-字节跳动-veomni-框架开源-统一多模态训练效率飞跃]]
