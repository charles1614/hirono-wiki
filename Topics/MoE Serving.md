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

**Expert Parallelism (EP) is the canonical serving primitive for MoE models.** Each device holds a subset of experts; an AlltoAll scatter dispatches each token to its assigned expert's device, expert compute runs locally, then an inverse AlltoAll reassembles the output. The per-token routing decision plus collective communication replaces the uniform per-layer batching of dense models, fundamentally changing the cost model. The correct EP degree depends on the operating mode: in TensorRT-LLM's deployment of gpt-oss-120b, the CUTLASS MoE backend enforces **pure EP only** (no mixed TP/EP), so max-throughput configurations must set `--ep ${num_gpus}`, while the TRTLLM MoE backend supports mixed TP/EP but recommends keeping EP small to avoid load imbalance ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]).

**Hardware determines which MoE backend is available — the TRTLLM MoE backend is not supported on Hopper (H200 included).** On H200, the only path is the OpenAI-shipped Triton MoE kernels that ship in the NGC container; CUTLASS support on Hopper is listed as ongoing. B200 and GB200 can use either TRTLLM or CUTLASS backends. This backend split directly gates which throughput ceiling is reachable: >20k tps/gpu on GB200 (DP4EP4, pure EP, CUTLASS) vs. the lower throughput of mixed TP/EP on Hopper ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]).

**Attention DP is the mode-defining knob, not the MoE backend.** Low-latency mode disables attention DP and targets tps/user (420 tps/user on 8× B200, batch 1); max-throughput mode enables attention DP and targets tps/gpu (19.5k tps/gpu on 4× B200, >20k on GB200). The YAML diff between modes is small — `enable_attention_dp` flip, MoE backend swap, `stream_interval: 10` — and the same `trtllm-serve` binary serves both ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]).

**Training-side parallelism choices directly constrain the EP degree achievable at serving time.** Classical frameworks cap `max(EP) ≤ DP` because the EP group is nested inside DP. MoE Parallel Folding (Megatron-Core) removes this constraint by decoupling the parallelism mappings of attention and MoE layers: attention uses TP × CP × DP × PP; MoE uses a separate TP × EP × DP × PP grouping; only PP must match across layers. A model trained with this folding can deploy with a higher EP degree than legacy frameworks allowed. The paper's primary focus is training MFU (49.3% on Mixtral 8×22B, 39.0% on Qwen2-57B-A14B on H100 at 1,024 GPUs), so direct serving-latency impact is unconfirmed from this source ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]).

**Drop vs. dropless is a serving-relevant dispatcher choice that the corpus leaves partially open.** Token-dropping (Switch Transformer-style, capacity factor CF ≥ 1) is cheaper but lossy; token-dropless (Megablocks-style) processes all tokens at the cost of more AlltoAll communication. MoE Parallel Folding's flexible dispatcher supports both paths under arbitrary parallelism combinations and eliminates sequence-length dependencies — which matters for variable-length inference workloads — but neither source benchmarks the quality-vs-throughput tradeoff for serving specifically ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]).

**Communication overlap is the load-bearing optimization for TP-heavy deployments.** Standard stream/event-based overlap underutilizes GPU SMs at scale because splitting one GEMM into N smaller GEMMs leaves SMs partially idle and stream timing is imprecise. Flux (ByteDance + PKU) fuses comm and compute at tile granularity into a single large kernel using CUTLASS, achieving up to 96% communication overlap and yielding 1.66× prefill / 1.30× decode speedups over vLLM on 8-GPU TP configurations ([[2025-10-09-flux-fast-software-based-communication-o]]). Flux also extends to AlltoAll (the EP communication primitive for MoE), though MoE is not the headline benchmark target.

**DeepSeek's MLA + MoE serving shape reshapes the bottleneck from memory to compute.** DeepSeek does not use tensor parallelism for decoding, keeping h_q = 128, which pushes the compute-to-memory ratio above H800's ~258 crossover point — making FlashMLA decode compute-bound rather than memory-bound. The FlashMLA seesaw schedule works around the register constraint that prevents FA-3's ping-pong schedule (a 64×512 output matrix requires 32,768 registers — half the SM's register file — so only one output per SM is possible), and achieves ~80% Tensor Core utilization on H800 ([[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]). The implication for MoE serving: high attention-head concurrency (TP=1 → large h_q) combined with fine-grained EP and AlltoAll-per-token is DeepSeek's architectural recipe; the compute-bound attention regime and EP-heavy MoE routing reinforce each other.

**Open threads the corpus does not resolve.** AlltoAll comm-overlap strategies — Flux's kernel-fusion approach vs. DeepSeek-V3-style per-EP-instance pipelining — coexist in the literature but are not benchmarked against each other. Fine-grained MoE (256+ experts, 8+ active per token as in DeepSeek-MoE) stresses the EP/AlltoAll path harder than Mixtral's 8-expert design; whether MoE Parallel Folding's MFU gains hold at that granularity is unconfirmed ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]). The drop-vs-dropless quality/throughput tradeoff for inference has no direct measurement in any of the four Sources.

## Comparison

| Axis | CUTLASS MoE backend (TRT-LLM, max-throughput) | TRTLLM MoE backend (TRT-LLM, low-latency) | Triton MoE backend (H200 only) | Flux comm-overlap (TP inference) | MoE Parallel Folding (Megatron-Core training) |
|---|---|---|---|---|---|
| **Primary use case** | Max-throughput serving (tps/gpu) | Low-latency serving (tps/user) | H200 / Hopper serving | TP-heavy prefill/decode overlap | MoE pretraining at scale |
| **EP configuration** | Pure EP only; `--ep ${num_gpus}` required ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | Mixed TP/EP; keep EP small ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | ? | AlltoAll support present; pure EP not the target use case ([[2025-10-09-flux-fast-software-based-communication-o]]) | TP × EP × DP × PP per-layer; removes EP ≤ DP ceiling ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]) |
| **Hardware support** | B200 / GB200; Hopper CUTLASS ongoing ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | B200 / GB200 ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | H200 (Hopper); NGC container ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | A100 / H800; PCIe + NVLink ([[2025-10-09-flux-fast-software-based-communication-o]]) | H100 (1,024-GPU validated) ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]) |
| **Peak throughput headline** | >20k tps/gpu on GB200 (DP4EP4); >1.5M tps on NVL72 ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | 420 tps/user on 8× B200, batch 1 ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | ? | 1.66× prefill / 1.30× decode vs. vLLM (8-GPU 8TP) ([[2025-10-09-flux-fast-software-based-communication-o]]) | 49.3% MFU (Mixtral 8×22B); 39.0% MFU (Qwen2-57B-A14B) ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]) |
| **Comm overlap mechanism** | ? | ? | ? | Tile-fused single CUTLASS kernel; up to 96% comm hidden ([[2025-10-09-flux-fast-software-based-communication-o]]) | Three-stage EP flow: AlltoAll → expert compute → inverse permutation ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]) |
| **Attention DP** | Enabled (`enable_attention_dp: true`) ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | Disabled (`enable_attention_dp: false`) ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | ? | N/A | N/A |
| **Drop vs. dropless** | ? | ? | ? | N/A | Both; flexible dispatcher, sequence-length-independent ([[2025-10-28-moeparallel-folding-heterogeneous-parall]]) |
| **TP for decoding** | TP=0 for attention in max-throughput mode (attention DP on) ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | Standard TP ([[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]) | ? | Requires TP ≥ 1; designed for TP-heavy configs ([[2025-10-09-flux-fast-software-based-communication-o]]) | N/A (training) |
| **MLA / DeepSeek relevance** | N/A | N/A | N/A | AlltoAll extension noted; not benchmarked for MoE ([[2025-10-09-flux-fast-software-based-communication-o]]) | N/A |

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

