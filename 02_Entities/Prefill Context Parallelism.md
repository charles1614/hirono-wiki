---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Prefill Context Parallelism

PCP — vLLM inference parallelism strategy for long-context MoE prefill; splits tokens across ranks with AllGather+ReduceScatter over expert layers

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- PCP is **MoE-layer-only** in the current [[vLLM]] v1 codebase: all attention backends set `supports_pcp = False`; attention-layer PCP is infrastructure-ready (rank/size tracked in `AttentionImplBase`) but not yet implemented. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- PCP **adds workers** to the world size (`world_size *= pcp_size`), unlike [[Decode Context Parallelism]] which subdivides the TP group. Token distribution is interleaved by position modulo `pcp_size`. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- Communication pattern in MoE layers: AllGather hidden states + router logits → redundant Top-K select on all ranks → each rank runs its local expert shard on all tokens → ReduceScatter outputs. AllGather before routing is required for globally consistent expert load balancing. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- PCP flattens into the EP sharding dimension: `flatten_tp_rank = dp_rank × pcp_size × tp_size + pcp_rank × tp_size + tp_rank`. With PCP=2, TP=2, 64 experts, each rank holds 16 experts — real expert-shard parallelism, not just sequence sharding. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- **Distinct from [[Chunked Pipeline Parallelism]] (CPP)**: CPP overlaps PP stages at the disaggregated-serving level to reduce FTL without wide TP; PCP is an in-engine parallelism axis adding workers and sharding tokens+expert weights. Orthogonal mechanisms, both targeting long-context MoE prefill. — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
