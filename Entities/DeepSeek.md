---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 4
tier: active
---

# DeepSeek

Chinese AI lab; produces open-weight frontier-grade MoE and dense models; published FlashMLA + DeepSeek-V3.

## Synthesis

Chinese AI lab producing open-weight frontier MoE and dense models — and notable for **publishing the kernel implementations behind their inference stack**. FlashMLA's design choices ([[MLA]] attention + no-TP-decoding + seesaw kernel schedule) reflect deliberate serving-economics decisions: keeping `h_q = 128` makes MLA decoding compute-bound on H800 (rather than memory-bound), justifying CUTLASS-level kernel optimization. The "publish the kernels, not just the weights" pattern (FlashMLA, DeepSeek-V3 inference system overview) is competitive transparency unusual in the frontier-model field.

## Observations

- FlashMLA documents a deliberate DeepSeek serving-economics choice: **no tensor parallelism on decode**, so `h_q = 128` and MLA decoding is compute-bound (not memory-bound) on H800. This shapes the kernel design — the seesaw schedule optimizes for compute-bound throughput, not memory-bandwidth. DeepSeek publishes the kernel source alongside the inference-system overview at github.com/deepseek-ai/open-infra-index. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **V4 architectural pivot** (2026-04-24, image-receipts via xhs interpretation piece): retired MLA, returned to MHA+GQA with **Compression Sparse Attention** + **on-disk KV cache** (compressed KV values stored on local SSD to eliminate repeated prefill for shared-prefix requests, V4 §3.3.2 / §3.6.2). Quantitative claims (verify against V4 paper when ingested): V4-Pro at 27% inference FLOPs + 10% KV cache vs V3.2 at 1M tokens. Bigger pattern beyond the numbers: the inventor of MLA chose to **fuse Chat and Agent infrastructure into one model** (unified Context + Attention + Token Scaling) rather than fork the architecture per use-case, and treats post-train compute as a co-equal scaling axis to pre-train — see V4 §3.5 *Scaling RL Framework for Million-Token Instruction-for-Agentic-AI*. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Publishes PyTorch Profiler traces** for V3/R1 training + inference (deepseek-ai/profile-data, April 2026): `train.json` (EP64/TP1, DualPipe two-chunk overlap, 112 SMs compute / 20 SMs comm), `prefill.json` (EP32/TP1, 108/24 SM split, two-micro-batch attention-balanced overlap), `decode.json` (EP128/TP1, **SM-freeing AllToAll via DeepEP** — after RDMA messages issued, all SMs freed for compute). This is the deepest receipts-level publication of overlap strategy in the V3/R1 lineage. — [[2026-04-03-deepseek-ai-profile-data-analyze-computa]]
