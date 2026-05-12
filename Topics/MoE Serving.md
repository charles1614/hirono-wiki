---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 4
---

# MoE Serving

## What

Inference-time techniques for [[MoE]] (Mixture-of-Experts) models — routing, dispatching, expert parallelism, AlltoAll comm patterns, drop-vs-dropless paths. Distinct from MoE *training* concerns because the latency budgets differ and per-request routing decisions matter for tail latency. The corpus mostly covers MoE *training* infrastructure (Megatron-Core's MoE Parallel Folding) and *kernel-level* serving substrate (FlashMLA, gpt-oss-120b on TensorRT-LLM) — pure serving-architecture content is sparser.

## Current understanding

**The dominant serving primitive is Expert Parallelism (EP).** EP shards experts across devices; an AlltoAll dispatches each token to its assigned expert's device, then an inverse AlltoAll restores order. The cost model is **per-token routing + collective comm**, contrasting with attention/FFN's per-token-batched-dense compute.

**Training-side decisions shape serving choices**. [[2025-10-28-moeparallel-folding-heterogeneous-parall]] (NVIDIA / Megatron-Core) removes the historical constraint that `max(EP) ≤ DP` (EP nested inside DP groups). The MoE-Parallel-Folding 5-D mapping (TP × EP × CP × DP × PP for attention; TP × EP × DP × PP for MoE; only PP shape must match) gives the serving stack the option to deploy with the same flexible mapping — though the paper focuses on training MFU (49.3% on Mixtral 8×22B, 39.0% on Qwen2-57B-A14B on H100).

**Drop vs dropless** is a serving-relevant choice with weak guidance:
- **Token-dropping** (Switch-Transformer style) sets a capacity factor `CF ≥ 1`; tokens above capacity are dropped. Cheaper, but lossy.
- **Token-dropless** (Megablocks style) processes all tokens. Higher quality, more comm.
- MoE Parallel Folding supports both via a unified flexible dispatcher, but doesn't compare quality vs throughput tradeoffs — open thread.

**Production deployment recipes** ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]): gpt-oss-120b on TensorRT-LLM exposes a concrete MoE-serving tradeoff via its low-latency vs max-throughput modes. **CUTLASS MoE backend supports only pure EP** (no mixed TP/EP) — so max-throughput forces `--ep ${num_gpus}`. Low-latency TRTLLM backend supports mixed TP/EP but with a recommendation to keep EP small (avoid MoE load imbalance). **H200 quirk**: TRTLLM MoE backend isn't supported on Hopper, so H200 deployments must use the OpenAI Triton MoE backend that ships in the NGC container.

**MLA + MoE is the DeepSeek serving shape**. FlashMLA ([[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]) is the decode-kernel half of DeepSeek's MoE-MLA serving stack. The kernel's compute-bound regime on H800 (`h_q × s_q ≥ 128`, hit by DeepSeek's no-TP-decode choice) shapes the rest of the stack: high concurrency + flexible EP rather than wide TP.

**Open architectural questions** (from Open threads):
- AlltoAll comm-overlap: Flux's fused-kernel approach vs per-EP-instance pipelining (DeepSeek-V3 style) — uncompared head-to-head.
- Fine-grained MoE (256+ experts, 8+ active per token, à la DeepSeek-MoE) stresses the EP/AllToAll path harder than Mixtral's 8 experts. Does MoE Parallel Folding extract similar gains at that fine-grain?

## Sources drawn on

- [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] — production gpt-oss-120b MoE-serving recipe on Blackwell (CUTLASS-vs-TRTLLM-vs-TRITON backend tradeoffs).
- [[2025-10-09-flux-fast-software-based-communication-o]] — kernel-fusion comm overlap including AlltoAll (relevant for EP dispatch).
- [[2025-10-28-moeparallel-folding-heterogeneous-parall]] — Megatron-Core's MoE Parallel Folding; the 5-D hybrid parallelism mapping that decouples attention from MoE.
- [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] — FlashMLA decode kernel; the MoE-MLA serving substrate for DeepSeek-class models.

## Open threads

- (to be filled in)
- How do TensorRT-LLM's gpt-oss-120b numbers scale to other MoE shapes (DeepSeek-V3, Mixtral 8×22B)? Config knobs are model-agnostic; ceilings may not be. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- AlltoAll for MoE: how does Flux's fused-kernel approach compare against per-EP-instance pipelining patterns used in modern MoE serving (e.g., DeepSeek-V3)? — [[2025-10-09-flux-fast-software-based-communication-o]]
- MoE Parallel Folding supports both token-dropping and token-dropless training; which is recommended for which scenario? The paper presents both as supported without comparing quality vs throughput tradeoffs. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- Does MoE Parallel Folding extract similar gains on fine-grained MoE (256+ experts, 8+ active à la DeepSeek-MoE) as on Mixtral's 8 experts? Fine-grained MoE stresses the EP/AllToAll path harder. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]


## Sources drawn on

- (auto-populated by reindex)
