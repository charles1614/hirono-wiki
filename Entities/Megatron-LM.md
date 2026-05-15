---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 22
tier: active
---

# Megatron-LM

NVIDIA's original tensor + pipeline + data parallelism training framework; foundational reference for large-model training; now subsumed into Megatron-Core.

## Synthesis


NVIDIA's open-source large-model training framework and canonical reference implementation for hybrid parallelism — it defines the tensor, pipeline, and data parallelism partitioning patterns that the broader ecosystem benchmarks against. Flux (ByteDance + PKU) uses Megatron-LM as its non-overlap baseline, achieving a 1.24× speedup over it on 128-GPU clusters (A100/H800, PCIe/NVLink) via kernel-fusion-based communication overlap — measuring the gap Megatron-LM's stream/event scheduling leaves on the table. Megatron-Core, the production-grade subpackage within the same repo, is where MoE Parallel Folding ships: NVIDIA's technique for decoupling the parallelism mappings of attention and MoE layers independently, achieving 49.3% MFU on Mixtral 8×22B at 1,024 H100 GPUs. Practitioners treating distributed training infrastructure seriously treat Megatron source-reading as effectively mandatory — pairing the codebase bottom-up with the DeepMind "How to Scale Your Model" book for the top-down cost-model framing.


## Observations

- Megatron Interleaved 1F1B（VP>1）稳态阶段相邻计算与通信无依赖，可 overlap；但最后一个 Stage 的额外 Logit & Loss 计算破坏此条件，在 PP=4/VP=2/GBS=8 实验中（4×A100，LLaMA 7B 16 层）导致 GPU 0/1/2 出现等待通信 bubble；扩大 GBS 后周期性延迟加剧。Native 1F1B 因通信操作直接用于下一步计算，存在强依赖，无法 overlap。 — [[2025-08-25-megatron-interleaved-1f1b流水线并行中的计算负载不均衡问]]
- Flux's training benchmark uses Megatron-LM as the non-overlap baseline — measured on 128-GPU clusters spanning A100/H800 + PCIe/NVLink with 2DP × 8PP × 8TP. Flux delivers 1.24× speedup over Megatron-LM at the high end (1.38× over TransformerEngine specifically). — [[2025-10-09-flux-fast-software-based-communication-o]]
- MoE Parallel Folding ships in **NVIDIA/Megatron-LM** (the open-source repo) as **Megatron-Core** — the production-path implementation of decoupled attention vs MoE parallelism mappings. Not theoretical; the technique is the documented Megatron recipe. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- **Practitioner-recommended source-reading priority** for training-infra learners. Per Jason 武器库's xhs comment: "if you're doing infra anyway, there's almost no way to skip reading source." Pairs as the canonical-implementation reference alongside the DeepMind scaling book (top-down conceptual + bottom-up source-read pairing). — [[2026-04-16-我在-汪志鹏的笔记下发布了一条评论-训练-infra-最好的资料应该就是-dee]]
- **Default training backend in slime**: slime's Megatron backend handles TP, PP, CP, expert parallelism for MoE models, and FP8 training, plus weight conversion between Megatron internal format and HuggingFace format for SGLang consumption. Slime also offers an experimental FSDP backend (`--train-backend fsdp`) for simpler setups. — [[2026-02-28-deepwiki-slime-01-overview]]
- Attention variants implemented in `megatron/core/transformer/attention.py`: MHA (standard), [[GQA]] (4–8× KV cache reduction, used by Llama-3), [[MLA]] (16× vs MHA via compressed latents, DeepSeek-V3), with pluggable backends (flash_attn, Transformer Engine, cuDNN SDPA, Triton, native). Tensor parallelism distributes attention heads via column-parallel QKV + row-parallel output projection. — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
- Feedforward MLP block in `megatron/core/transformer/mlp.py` supports standard FC1→Activation→FC2 (8H² params) and GLU variants (SwiGLU/GEGLU); column-parallel FC1 + row-parallel FC2 with AllReduce achieves 4× parameter reduction per GPU at TP=4; fused bias+activation kernels give 15–20% speedup; activation checkpointing reduces MLP activation memory by ~63%. — [[2026-01-21-deepwiki-megatron-lm-13-feedforward-netw]]
- Context Parallelism (CP) in Megatron splits the sequence dimension across CP_size GPUs, achieving quadratic memory reduction (CP²); at seq=32K, CP=4 reduces attention elements 16×. Four communication strategies: P2P ring (memory-efficient, best for large CP), All-to-All (parallel, best for CP=2–8), AllGather (simplest), and hybrid a2a+p2p (intra-node NVLink + inter-node IB). CP is orthogonal to TP and supports hierarchical multi-node configurations. — [[2026-01-21-deepwiki-megatron-lm-08-context-parallel]]
- Tensor parallelism implementation: `ColumnParallelLinear` shards output dimension, `RowParallelLinear` shards input dimension with AllReduce. Column→Row chaining eliminates inter-layer communication; attention uses column-parallel QKV + row-parallel output projection. Total: 3 AllReduces per transformer layer (forward: 1, backward: 2). Sequence Parallelism (SP) distributes LayerNorm and Dropout along sequence dimension: each GPU holds [B, S/TP, H]; AllGather before attention, ReduceScatter after; activation memory savings ~30% at TP=8. Optimal TP is power-of-2 ≤ GPUs per node (NVLink domain); cross-node TP at TP=16 runs at ~40% efficiency due to 16× IB-vs-NVLink bandwidth gap. — [[2026-01-28-deepwiki-megatron-lm-05-tensor-paralleli]]
