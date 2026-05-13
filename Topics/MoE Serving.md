---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 8
---

# MoE Serving

## What

Inference-time techniques for [[MoE]] (Mixture-of-Experts) models — routing, dispatching, expert parallelism, AlltoAll comm patterns, drop-vs-dropless paths. Distinct from MoE *training* concerns because the latency budgets differ and per-request routing decisions matter for tail latency. The corpus mostly covers MoE *training* infrastructure (Megatron-Core's MoE Parallel Folding) and *kernel-level* serving substrate (FlashMLA, gpt-oss-120b on TensorRT-LLM) — pure serving-architecture content is sparser.

## Current understanding

**Expert Parallelism (EP) is the dominant serving primitive for MoE models.** Each device holds a subset of experts; an AlltoAll dispatches each token to the device that owns its assigned expert, expert compute runs locally, then an inverse AlltoAll reassembles the output. The cost model — per-token routing decision plus collective communication — is structurally different from dense attention or FFN, where the compute is batched uniformly across tokens. The correct EP degree depends on the use case: [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] shows that NVIDIA's CUTLASS MoE backend enforces pure EP only (no mixed TP/EP), so max-throughput configurations must set `--ep ${num_gpus}`, while the lower-throughput TRTLLM backend supports mixed TP/EP but with guidance to keep EP small to avoid load imbalance.

**Training-side parallelism choices directly constrain the serving topology.** [[2025-10-28-moeparallel-folding-heterogeneous-parall]] removes the classical constraint that EP must be nested inside DP (i.e., `max(EP) ≤ DP`) by decoupling the parallelism mappings of attention and MoE layers. Attention uses a TP × CP × DP × PP grouping; MoE uses a separate TP × EP × DP × PP grouping; only the PP shape must match. This gives a model trained with MoE Parallel Folding the option to be deployed with a higher EP degree than legacy frameworks allowed — though the paper focuses on training MFU (49.3% on Mixtral 8×22B, 39.0% on Qwen2-57B-A14B on H100) rather than serving latency directly.

**Drop vs. dropless is a serving-relevant choice that Sources leave partially open.** Token-dropping (Switch Transformer style, capacity factor CF ≥ 1) is cheaper but lossy; token-dropless (Megablocks style) processes all tokens at the cost of more communication. MoE Parallel Folding's flexible dispatcher supports both paths under arbitrary parallelism combinations [[2025-10-28-moeparallel-folding-heterogeneous-parall]], but neither source benchmarks the quality-vs-throughput tradeoff for serving. The dispatcher does eliminate sequence-length dependencies, which matters for variable-length inference workloads.

**Communication overlap is the load-bearing optimization for TP-heavy deployments.** [[2025-10-09-flux-fast-software-based-communication-o]] demonstrates that the standard stream/event approach to overlapping AllGather/ReduceScatter underutilizes GPU SMs at scale — splitting one GEMM into N smaller GEMMs leaves SMs partially idle, and timing control via streams is imprecise. Flux's kernel-fusion approach (tile-level decomposition fused into a single large kernel) overlaps up to 96% of communication and yields 1.66× prefill / 1.30× decode speedups over vLLM on 8-GPU TP configurations. For MoE specifically, Flux also handles AlltoAll (the EP communication primitive), though MoE is not the headline use case — the primary framing is TP overlap.

**Hardware quirks drive backend selection in production.** The TensorRT-LLM deployment recipe for gpt-oss-120b [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] exposes a concrete hardware-backend constraint: the TRTLLM MoE backend is not supported on Hopper (H200 included), so H200 deployments must use the OpenAI Triton MoE backend that ships in the NGC container. CUTLASS MoE support on Hopper is listed as ongoing. B200/GB200 can use the TRTLLM or CUTLASS backends. The max-throughput headline — >20k tps/gpu on GB200 (DP4EP4), translating to >1.5M tps on a GB200 NVL72 — reflects Blackwell with pure EP, which the CUTLASS backend requires.

**MLA + MoE is DeepSeek's serving shape, and it reshapes the bottleneck from memory to compute.** [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] shows that FlashMLA's decode kernel operates in a compute-bound regime on H800 specifically because DeepSeek does not use tensor parallelism for decoding — this keeps `h_q = 128`, pushing the compute-to-memory ratio above H800's ~258 crossover. The implication for MoE serving: high attention-head concurrency (no TP → large h_q) in combination with fine-grained EP (many small experts, AlltoAll per token) is DeepSeek's architectural recipe. FlashMLA's seesaw schedule achieves ~80% Tensor Core utilization at this operating point.

**Open threads the corpus does not resolve.** AlltoAll comm-overlap strategies are not compared head-to-head: Flux's CUTLASS kernel-fusion approach vs. DeepSeek-V3-style per-EP-instance pipelining both exist but are not benchmarked against each other. Fine-grained MoE (256+ experts, 8+ active per token as in DeepSeek-MoE) stresses the EP/AlltoAll path considerably harder than Mixtral's 8-expert design; whether MoE Parallel Folding's MFU gains hold at that granularity is unconfirmed. And the drop-vs-dropless quality/throughput tradeoff for inference (as opposed to training) has no direct measurement in any of the four Sources.

## Open threads

- How do TensorRT-LLM's gpt-oss-120b numbers scale to other MoE shapes (DeepSeek-V3, Mixtral 8×22B)? Config knobs are model-agnostic; ceilings may not be. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- AlltoAll for MoE: how does Flux's fused-kernel approach compare against per-EP-instance pipelining patterns used in modern MoE serving (e.g., DeepSeek-V3)? — [[2025-10-09-flux-fast-software-based-communication-o]]
- MoE Parallel Folding supports both token-dropping and token-dropless training; which is recommended for which scenario? The paper presents both as supported without comparing quality vs throughput tradeoffs. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- Does MoE Parallel Folding extract similar gains on fine-grained MoE (256+ experts, 8+ active à la DeepSeek-MoE) as on Mixtral's 8 experts? Fine-grained MoE stresses the EP/AllToAll path harder. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]

## Sources drawn on

- [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] — production gpt-oss-120b MoE-serving recipe on Blackwell (CUTLASS-vs-TRTLLM-vs-TRITON backend tradeoffs).
- [[2025-10-09-flux-fast-software-based-communication-o]] — kernel-fusion comm overlap including AlltoAll (relevant for EP dispatch).
- [[2025-10-28-moeparallel-folding-heterogeneous-parall]] — Megatron-Core's MoE Parallel Folding; the 5-D hybrid parallelism mapping that decouples attention from MoE.
- [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] — FlashMLA decode kernel; the MoE-MLA serving substrate for DeepSeek-class models.

