---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: entity
refs: 3
tier: active
---

# DeepSeek

Chinese AI lab; produces open-weight frontier-grade MoE and dense models; published FlashMLA + DeepSeek-V3.

## Synthesis


Chinese AI lab notable for publishing not just model weights but the operational internals of its inference stack — kernel source, profiler traces, and architectural tech reports — at a depth unusual among frontier-model developers. Its V3/R1 serving infrastructure reflects deliberate co-design choices: no tensor parallelism on decode keeps h_q at 128, making MLA decoding compute-bound rather than memory-bound on H800, which in turn justifies CUTLASS-level kernel optimization (the seesaw schedule in FlashMLA) and SM-lane partitioning where 112 SMs run compute disjoint from 20 SMs handling communication. The V4 architectural pivot — retiring MLA in favor of MHA+GQA with Compression Sparse Attention and on-disk KV cache stored on local SSD — signals that long-context efficiency at the million-token scale, not per-token KV compression, has become the dominant design axis; the inventor of MLA walking away from MLA is itself the story. V4 also treats post-training compute as a co-equal scaling axis to pre-training, and fuses Chat and Agent infrastructure into one model rather than forking the architecture per use-case. The published PyTorch Profiler traces for V3/R1 training, prefill, and decode provide an inspectable 2026 baseline for production MoE overlap strategy, including the SM-freeing AllToAll mechanism via DeepEP that makes EP128 decode viable.


## Observations

- FlashMLA documents a deliberate DeepSeek serving-economics choice: **no tensor parallelism on decode**, so `h_q = 128` and MLA decoding is compute-bound (not memory-bound) on H800. This shapes the kernel design — the seesaw schedule optimizes for compute-bound throughput, not memory-bandwidth. DeepSeek publishes the kernel source alongside the inference-system overview at github.com/deepseek-ai/open-infra-index. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **V4 architectural pivot** (2026-04-24, image-receipts via xhs interpretation piece): retired MLA, returned to MHA+GQA with **Compression Sparse Attention** + **on-disk KV cache** (compressed KV values stored on local SSD to eliminate repeated prefill for shared-prefix requests, V4 §3.3.2 / §3.6.2). Quantitative claims (verify against V4 paper when ingested): V4-Pro at 27% inference FLOPs + 10% KV cache vs V3.2 at 1M tokens. Bigger pattern beyond the numbers: the inventor of MLA chose to **fuse Chat and Agent infrastructure into one model** (unified Context + Attention + Token Scaling) rather than fork the architecture per use-case, and treats post-train compute as a co-equal scaling axis to pre-train — see V4 §3.5 *Scaling RL Framework for Million-Token Instruction-for-Agentic-AI*. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Publishes PyTorch Profiler traces** for V3/R1 training + inference (deepseek-ai/profile-data, April 2026): `train.json` (EP64/TP1, DualPipe two-chunk overlap, 112 SMs compute / 20 SMs comm), `prefill.json` (EP32/TP1, 108/24 SM split, two-micro-batch attention-balanced overlap), `decode.json` (EP128/TP1, **SM-freeing AllToAll via DeepEP** — after RDMA messages issued, all SMs freed for compute). This is the deepest receipts-level publication of overlap strategy in the V3/R1 lineage. — [[2026-04-03-deepseek-ai-profile-data-analyze-computa]]
