---
created: 2026-05-11
updated: 2026-05-12
type: entity
refs: 2
tier: active
---

# DeepSeek

Chinese AI lab; produces open-weight frontier-grade MoE and dense models; published FlashMLA + DeepSeek-V3.

## Synthesis

Chinese AI lab producing open-weight frontier MoE and dense models — and notable for **publishing the kernel implementations behind their inference stack**. FlashMLA's design choices ([[MLA]] attention + no-TP-decoding + seesaw kernel schedule) reflect deliberate serving-economics decisions: keeping `h_q = 128` makes MLA decoding compute-bound on H800 (rather than memory-bound), justifying CUTLASS-level kernel optimization. The "publish the kernels, not just the weights" pattern (FlashMLA, DeepSeek-V3 inference system overview) is competitive transparency unusual in the frontier-model field.

## Observations

- FlashMLA documents a deliberate DeepSeek serving-economics choice: **no tensor parallelism on decode**, so `h_q = 128` and MLA decoding is compute-bound (not memory-bound) on H800. This shapes the kernel design — the seesaw schedule optimizes for compute-bound throughput, not memory-bandwidth. DeepSeek publishes the kernel source alongside the inference-system overview at github.com/deepseek-ai/open-infra-index. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **V4 architectural shift (reported, unverified at the V4-tech-report level in the corpus)**: per an xhs interpretation piece, V4 retired MLA entirely and adopted a hybrid attention scheme (CSA + HCA — Content Sparse Attention + Hierarchical Compressed Attention) that compresses a claimed 1M-token KV cache to ~5 GB. If accurate, this is the inventor of MLA walking away from per-token KV compression in favor of sequence-dimension compression — a category shift, not an incremental optimization. Should be re-verified directly against V4's tech report when that's ingested. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
