---
created: 2026-05-13
updated: 2026-05-13
type: meta
---

# Synthesis — what this corpus argues

The wiki is a working argument about **the systems layer of frontier LLMs**: how training and inference get built, what hardware shapes the design space, and where the open questions sit as of mid-2026. This page is the through-line. It is regenerated, not appended — when the corpus shifts, this page is rewritten.

## 1. The systems layer is a database problem in disguise

The most useful cross-cutting frame in the corpus is the **cs.DB framing** introduced by the Pan + Li inference survey (see [[Topics/LLM Inference Systems]]). Request scheduling is query planning; KV cache is buffer-pool management; eviction is page replacement; disaggregation is distributed query execution; continuous batching is interleaved transaction processing. Decades of database systems research are under-applied to LLM serving, and the gap is both the open research frontier and the fastest path to near-term wins. The same lens explains why [[Topics/Distributed-Serving Observability]] is converging on tracing primitives borrowed from OpenTelemetry / Perfetto rather than inventing from scratch — the operator problem ("which request is slow and why") is shaped like a distributed-query problem.

## 2. Precision is the dominant lever, and it is moving from FP8 to FP4

Across [[Topics/Low-Precision Training]], [[Topics/FP8 Computation]], [[Topics/Numerical Precision]], and [[Topics/Quantization]], the corpus argues that **narrowing the number format is the single highest-leverage move** in 2025–2026 systems work. NVIDIA's 12B-param / 10T-token [[NVFP4]] pretraining run is the existence proof that 4-bit training is viable; the four co-design ingredients (Random Hadamard transforms, 2-D quantization, stochastic rounding, selective high-precision retention for stability-critical operators) are now the standard recipe. The TPU side ([[Ironwood]]) is closing the FP8-native gap just as Blackwell ([[Topics/AI Accelerators]]) introduces native FP4 — both vendors converging on narrower formats as the primary economic lever. The unresolved question is whether [[Topics/FP Emulation]] (software-emulated FP4 on FP8-native silicon) is bridgeable or whether the hardware tax is structural.

## 3. Parallelism has settled; the variation is in scheduling and overlap

[[Topics/Parallelism Strategies]], [[Topics/Tensor Parallelism]], [[Topics/Pipeline Parallelism]], [[Topics/Context Parallelism]], [[Topics/Expert Parallelism]], and [[Topics/Hybrid Parallelism]] collectively argue that the **decomposition vocabulary is mature** — TP/PP/DP/EP/CP — and that frontier work has moved to *how* the decompositions overlap and schedule. [[Topics/Communication-Computation Overlap]] is now a settled lever (Flux's kernel-fusion comm overlap delivers 1.66× prefill / 1.30× decode over vLLM on 8-GPU TP); [[Topics/MoE Training]] and [[Topics/MoE Serving]] are where the most active design churn sits, because the expert-routing axis composes with every other parallelism dimension. The deeper claim: parallelism mappings are now hardware-shaped, not algorithm-shaped — the right TP×EP×CP combination depends on the specific accelerator's NVLink topology and HBM bandwidth, not on the model.

## 4. Inference disaggregation is conditional, not universal

[[Topics/Inference Disaggregation]] is the most design-space-dependent choice the corpus documents. NVIDIA's 100k+ design-point study (the empirical anchor) shows disaggregation wins are concentrated in **prefill-heavy traffic + large models (>10B)**; for small models or generation-heavy traffic, piggybacked co-located serving is competitive. The load-bearing primitive is **dynamic rate matching** of the Ctx:Gen GPU ratio — fixed ratios are Pareto-suboptimal across latency regimes. The corpus closes the "KV bandwidth bottleneck" hypothesis: provisioned datacenter bandwidth is analytically sufficient for KV transfer across realistic SLAs. The remaining open thread is whether [[Topics/Serverless LLM Serving]] is a separate composition tier or orthogonal to single/multi/disaggregated.

## 5. Kernels are register-budget exercises, not algorithmic choices

[[Topics/Attention Kernels]], [[Topics/Kernel Authoring]], [[Topics/Kernel Fusion]], [[Topics/Tensor Core Programming]], and [[Topics/GPU Microarchitecture]] collectively argue that **modern attention-kernel design is constrained by register budgets and warpgroup scheduling, not by algorithmic preference**. The clearest case: [[FlashMLA]]'s "seesaw" schedule (splitting output O_L/O_R vertically across two warpgroups) is forced by register pressure, not chosen over [[FlashAttention]]-3's ping-pong schedule on theoretical grounds. The same lens explains [[Topics/Kernel Authoring Languages]]'s split — Triton wins where the register-budget search is automatable; CUDA + CUTLASS wins where humans need to dictate the schedule. [[Topics/GPU Performance Modeling]] is the bridge: roofline + arithmetic-intensity analysis is the only reliable way to predict which side of the memory/compute crossover a kernel will land on.

## 6. The accelerator landscape is bifurcating, not consolidating

[[Topics/AI Accelerators]], [[Topics/Accelerator Economics]], [[Topics/Inference-Optimized Accelerators]], [[Topics/Power Efficiency]], and [[Topics/Vertical Integration]] collectively argue that **2025-2026 is the first year since 2018 where the GPU-only assumption is materially weakened**. [[Ironwood]] (Google's first inference-first TPU at scale — 4,614 TFLOPS FP8, 192 GB HBM, 9,216-chip pods at 42.5 EFLOPS) is the strongest public counter-argument to GPU-only inference. The power-efficiency case (TPU v4 at 1.2-1.7× A100 throughput at 53–77% of the power) holds; the unresolved question is **distribution** — Google Cloud-only access vs open market — which is an economics-and-go-to-market question, not a silicon question. NVIDIA's response visible in the corpus: vertical stack integration (Blackwell + NVLink + Transformer Engine + TensorRT-LLM as one bundle), not silicon-only competition.

## Open threads

Cross-cutting questions the corpus has not yet resolved:

- **Is serverless orthogonal to disaggregation, or downstream of it?** ([[Topics/Serverless LLM Serving]] / [[Topics/LLM Inference Systems]])
- **Does the FP8-emulated-FP4 path on Hopper bridge the gap to Blackwell, or is the hardware tax structural?** ([[Topics/FP Emulation]] / [[Topics/Low-Precision Training]])
- **Will prescriptive operator recipes (TensorRT-LLM's two-mode YAML) become the industry norm, or will framework-as-toolkit (vLLM / SGLang) hold?** ([[Topics/LLM Inference Systems]])
- **Will Ironwood displace a material slice of frontier GPU inference workloads, or will Google-only-access cap its reach?** ([[Topics/Accelerator Economics]] / [[Topics/Vertical Integration]])
- **Does the cs.DB framing surface specific database techniques (e.g. MVCC for speculative-decoding rollback, cost-based query optimization for batch scheduling) that aren't yet propagated?** ([[Topics/LLM Inference Systems]] / [[Topics/Database Systems × ML Systems]])

## How this page stays current

This is a `type: meta` page. Regenerate when:

- A new Source materially changes one of the six section claims (rare — most ingests refine, don't shift).
- A new Topic crosses the synthesis-density threshold (e.g. ≥5 cited Sources) and isn't yet reflected here.
- An "Open thread" closes — move it into the relevant section as a settled claim.

Cadence is *per-batch*, not per-ingest. After every `hirono auto-curate` run, re-read this page; if any section's claim is now wrong, regenerate the whole page (don't patch a paragraph). See [[Meta/operator-workflows]] §11.4.
