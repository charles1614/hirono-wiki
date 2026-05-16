---
created: 2026-05-11
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 26
---

# Parallelism Strategies

## What

*Stub topic — to be expanded from sources.*

## Current understanding

Large-scale LLM training distributes work across thousands of GPUs using a combination of parallelism axes: **Tensor Parallelism (TP)** splits individual weight matrices across devices, **Pipeline Parallelism (PP)** stages model layers across device groups, **Data Parallelism (DP)** replicates the model and shards the data batch, **Context Parallelism (CP)** shards the sequence dimension for long-context training, and **Expert Parallelism (EP)** distributes MoE expert weights across devices. A 5-D hybrid parallel configuration combines all five: `TP × EP × CP × DP × PP`.

The central design question is how to assign each axis to each layer type. The naive approach uses a single uniform parallelism mapping for the entire model — every layer, whether attention or MoE FFN, is placed into the same group structure. This is suboptimal because attention and MoE layers have fundamentally different compute and communication profiles: attention is whole-sequence dense and benefits from TP and CP, while MoE is per-token sparse and benefits most from EP (which routes tokens to the relevant expert shards) rather than ETP (Expert Tensor Parallelism, which shards each expert's weights and incurs high AllReduce cost). [[2025-10-28-moeparallel-folding-heterogeneous-parall]]

The classical constraint compounded the problem: prior frameworks nested the EP group as a sub-group of DP, so `max(EP) ≤ DP`. This ceiling limits expert parallelism at exactly the scale where more EP would be most valuable — when training large MoE models across 512+ GPUs with many experts. [[2025-10-28-moeparallel-folding-heterogeneous-parall]]

**MoE Parallel Folding** (NVIDIA / Megatron-Core, arXiv:2504.14960) removes both constraints. The construction defines two independent 4-D parallelism groups per model: an attention group (`TP × CP × DP × PP`) and a MoE group (`TP × EP × DP × PP`, where TP here is ETP and DP here is EDP). The only invariant is that PP group shape must match between the two — everything else is decoupled. This allows the attention layers to be assigned full TP+CP while the MoE layers use EP instead of ETP, replacing expensive AllReduce with cheaper AllToAll, and fitting intra-layer communication within high-bandwidth intra-node networks (NVLink) rather than crossing slower inter-node links. [[2025-10-28-moeparallel-folding-heterogeneous-parall]]

The systems load-bearing component is a **flexible token-level dispatcher** that handles both token-dropping (Switch Transformer-style, with capacity factor `CF · L / E`) and token-dropless (Megablocks-style) routing under arbitrary parallelism combinations. Token count per rank varies dynamically with routing decisions, so the dispatcher must support dynamic tensor shapes — a non-trivial requirement when the parallelism mapping is heterogeneous. The EP communication flow is three-stage: AllToAll dispatch → expert FFN computation (no communication) → inverse permutation restore. [[2025-10-28-moeparallel-folding-heterogeneous-parall]]

Results on H100: **49.3% MFU on Mixtral 8×22B** and **39.0% MFU on Qwen2-57B-A14B** at up to 1,024 GPUs and 128K sequence length, with loss curves matching vanilla Megatron-Core throughout training (quality is preserved). The technique ships in [NVIDIA/Megatron-LM](https://github.com/NVIDIA/Megatron-LM) (Megatron-Core), making it an immediately adoptable production recipe rather than a theoretical result. [[2025-10-28-moeparallel-folding-heterogeneous-parall]]

The generalizable principle beyond MoE: **heterogeneous parallelism mappings between layer types** is the right design primitive for any architecture with structurally dissimilar layers — multimodal models, MoD-MoE hybrids, speech-language systems. The EP-degree ceiling (`max(EP) ≤ DP`) was a real-world constraint that MoE Parallel Folding removes; teams sizing TP/EP/DP allocations at 512+ GPU scale no longer need to budget EP within the DP limit.

**Inference-time Context Parallelism** splits further into two distinct sub-axes in production engines. [[vLLM]] (source commit 4061dcf4c) implements **[[Prefill Context Parallelism]] (PCP)** — adds workers, shards tokens by interleaved position, and uses AllGather + ReduceScatter around MoE expert computation — and **[[Decode Context Parallelism]] (DCP)** — subdivides the TP group to shard KV cache across ranks, with partial attentions combined via LSE (`logsumexp`). PCP is MoE-only today (attention-layer PCP infrastructure exists but all backends set `supports_pcp = False`). The two can compose as a 2D CP grid. DCP at scale=4 enables 4× KV memory reduction on a fixed TP=8 configuration. Notably, PCP increases EP group size: `EP_group_size = dp_size × pcp_size × tp_size`, so adding PCP ranks enlarges the expert sharding domain. [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]

## Open threads

- Can a 6th dim (Megatron-SP-style sequence parallelism within attention TP) be folded similarly in MoE Parallel Folding? — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- For 128K-context training: how does Context Parallelism interact with MoE Parallel Folding? CP only attaches to the attention side of the fold — implications for long-context MoE training are non-trivial. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]


- Pathways (MLSys 2022) articulated single-controller vs. multi-controller as the fundamental axis for distributed ML programming: multi-controller (SPMD/MPI) suits homogeneous DP; single-controller suits heterogeneous MPMD graphs (RL training, PD disaggregated inference) where each graph node has distinct resource requirements. [[verl]] and Ray serve as the open-source realization of the single-controller pattern for RL post-training. — [[2025-05-30-https-zhuanlan-zhihu-com-p-1911558458903]]

## Sources drawn on

- (auto-populated by reindex)
- [[2025-07-05-rmt-lw-jwfgic9orkz-xx5cg00-gn-kc]] — Communication pattern table: TP=allreduce/allgather/reducescatter/alltoall, DP=allreduce/allgather/reducescatter, EP=allgather/reducescatter/alltoall, PP=send/recv; per-layer forward/backward assignments.
- [[2025-07-15-https-www-zhihu-com-question-19271405065]] — Kimi K2 EP+DP attention architecture: DP Attention replicates QKVO projections across all ranks (not sharded); head reduction saves 5 GB/rank on every EP size — unlike TP where bandwidth savings scale with parallelism.
