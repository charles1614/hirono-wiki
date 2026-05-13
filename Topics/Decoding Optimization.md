---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 6
---

# Decoding Optimization

## What

Techniques for accelerating autoregressive decoding — speculative sampling, prefix caching, kernel-level scheduling.

## Current understanding

Autoregressive decoding is the central throughput bottleneck in LLM inference: generating one token at a time, with the KV cache growing linearly and each decode step memory-bandwidth-bound at small batch sizes. The techniques that address this bottleneck split into three largely orthogonal tracks — speculative token generation, prefix cache reuse, and kernel-level scheduling — each attacking a different layer of the pipeline.

**Speculative sampling** is the most-studied acceleration technique in the corpus. The basic mechanism (draft model proposes tokens; target model verifies in parallel; agreement yields multi-token steps at single-step cost) is now textbook, but the frontier has moved to *scaling laws for draft models*. [[2025-10-09-eagle-3-scalingupinference-acceleration-]] establishes that EAGLE-style draft-model quality scales smoothly with training compute, and critically shows **40% throughput gain at batch size 64** on SGLang — refuting the earlier assumption that speculation only helps latency-constrained single-user settings. The production minimal configuration from Ant Group's H20 deployment ([[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]) is instructive: `NEXTN --speculative-num-steps 1 --speculative-eagle-topk 1 --speculative-num-draft-tokens 2` — simple enough to coexist with the existing kernel zoo without complicating CUDA graph capture.

**Prefix caching** has a well-understood goal (reuse KV blocks across requests that share a prompt prefix) but the system complexity emerges at the scheduling layer. Baidu's AttentionStore [[2026-04-01-拒绝-openclaw-成为-吞金龙虾-百度百舸打造极致-kv-cache-调度]] demonstrates that the win requires **two levels of coordination**: a cluster-level scheduler with a global block-location index (routing requests to cache-hot nodes) and a node-level 3-tier store (HBM / DRAM / SSD) with pipelined reads. Their headline result — **6.2× TTFT reduction** vs SGLang's default cache policy on DeepSeek R1 671B at 64K context — is attributable to the pipelining trick (huge-page + pinned-memory enabling simultaneous DRAM→HBM and SSD→DRAM transfers), not to faster interconnects. This aligns with NVIDIA's analytical finding ([[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]) that provisioned datacenter bandwidth is already sufficient for KV cache transfer; the bottleneck is scheduling and storage-tier orchestration, not the link itself.

**Kernel-level scheduling** for the decode attention step is where the MLA-specific work lives. [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]] establishes that MLA decoding on H800 is **compute-bound, not memory-bound** — because DeepSeek doesn't tensor-parallel the decode instances, `h_q = 128` keeps the compute-to-memory ratio above the roofline crossover at 258 FLOPs/byte. The consequence is that FlashAttention-3's standard ping-pong schedule doesn't apply (the 64×512 output matrix consumes half the SM's register file, leaving no room for a second output buffer), and a novel "seesaw" schedule — splitting the output matrix vertically across two warpgroups operating on alternating KV blocks — is required to achieve CUDA-Core/Tensor-Core overlap. The production result is 80% Tensor Core utilization on the throttled H800 peak.

The three tracks compose but don't fully substitute for one another. Speculative decoding improves tokens-committed-per-target-step; prefix caching reduces TTFT by avoiding KV recomputation; kernel optimization raises the ceiling on decode throughput per GPU. The [[2026-05-08-a-survey-of-llm-inference-systems]] framing of "load prediction / adaptive mechanisms / cost reduction" as the three cross-cutting primitives maps cleanly: speculation is an adaptive mechanism, prefix caching is cost reduction, and kernel tuning is cost reduction at the hardware-utilization layer.

The main unresolved question in the corpus is the interaction between **prefill-decode disaggregation** and all three tracks. [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] shows disaggregation wins concentrate in prefill-heavy traffic on large models — but disaggregation reshapes the operational context for both speculation (does a separate decode pool make draft-model scheduling easier or harder?) and prefix caching (cross-instance cache reuse requires the cluster-level scheduler AttentionStore provides). The Ant production deployment ([[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]]) uses disaggregation as the outer architecture and runs speculation + kernel optimizations *within* the decode pool — the composition is operational but the Pareto tradeoffs are still being characterized.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
