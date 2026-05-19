---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://lmsys.org/blog/2025-05-05-large-scale-ep/
tags: [inference, disaggregation, moe, parallelism, production-deployment, gpu]
---

# [2025-09-05] Deploying DeepSeek with PD Disaggregation and Large-Scale Expert Parallelism on 96 GPUs

## TL;DR

SGLang Team blog (May 5, 2025) — the **first open-source implementation to nearly match DeepSeek's own reported throughput** for DeepSeek-V3, using 12 nodes × 8 H100 GPUs. The system combines PD disaggregation with large-scale Expert Parallelism (EP72 decode, EP32 prefill), DeepEP dispatch modes, DeepGEMM grouped GEMMs, EPLB load balancing, and a Two-Batch Overlap (TBO) pipeline. Headline: **52.3k input tokens/sec and 22.3k output tokens/sec per node** for 2K-token inputs; 5× throughput improvement over vanilla TP16 on the same hardware. Cost estimate: \$0.20/1M output tokens — one-fifth of the official DeepSeek Chat API.

## Key claims

- **PD disaggregation is load-bearing for large-scale EP.** Unified scheduling breaks DeepEP's normal vs. low-latency dispatch split — normal dispatch (prefill, throughput-optimized, symbolic shapes) and low-latency dispatch (decode, CUDA-Graph-compatible, pre-allocated memory) cannot coexist in the same communication group without PD disaggregation. Three additional pathologies in unified scheduling: prefill interrupts decode batches; DP Attention imbalance when one worker handles prefill while another handles decode; incompatibility with DeepEP. — [[2025-09-05-deploying-deepseek-with-pd-disaggregatio]]
- **DP Attention, not TP, is the right parallelism for attention layers.** MLA with DP Attention eliminates KV cache duplication across devices, reducing memory overhead. For dense FFNs, DP is preferred over TP: at TP32, DeepSeek-V3's intermediate dim 18,432 fragments into 576-unit segments (not divisible by 128 — H100 alignment boundary), degrading efficiency. DP also cuts communication from 2× all-reduce per FFN down to one reduce-scatter + one all-gather (50% reduction). Memory-optimal TP for DeepSeek-V3 dense FFNs is ≤ 6 across decode configurations.
- **EPLB delivers 1.49× prefill and 2.54× decode speedup at large EP scale.** Without load balancing, EP imbalance grows with EP size — some GPUs sit idle while others hit their token-count ceiling. EPLB takes expert usage statistics as input and places 288 experts (256 original + 32 redundant) across GPUs to minimize the max-vs-mean token-count gap. Redundant experts also unlock non-power-of-2 EP sizes (e.g., EP12, EP72) previously precluded by the 256-expert constraint.
- **Two-Batch Overlap (TBO) gives 27–40% throughput gains and doubles supported batch size on prefill.** TBO splits a batch into two micro-batches, overlapping compute (attention, MLP) with communication (DeepEP combine + dispatch). On prefill, TBO enables 16K tokens/device vs. 8K OOM limit without TBO (40.5% throughput boost at optimal batch). On decode, gains require batch size ≥ 64–128; speedup is 25.5% at 256 tokens/device (22,310 tps). Simulated MTP at 128 sequences: 35% speedup (17,552 vs 12,929 tps without TBO).
- **Implementation uses a `YieldOperation` abstraction** to write TBO as single-micro-batch logic, inserting yield points between operations. Eliminates code duplication and handles cases where one micro-batch finishes early. CPU-blocking issue in normal dispatch (DeepEP blocks CPU until metadata from other ranks arrives) is resolved by submitting GPU computation tasks *before* launching the blocking communication — keeps GPU active during the stall.
- **DeepGEMM provides phase-specific grouped GEMM kernels.** Contiguous-layout kernel (dynamic shapes, prefill) pairs with DeepEP normal dispatch; masked-layout kernel (fixed shape, CUDA-Graph-compatible) pairs with low-latency dispatch for decode. A custom Triton permutation kernel bridges the symbolic-shape output of normal dispatch into the contiguous layout the GEMM kernel expects.
- **Profile results vs. DeepSeek official:** Prefill (4-node EP32, 4K input, 16K tokens/device): SGLang default 50,302 tps/node (20% below DeepSeek profile 62,713); with simulated perfect EPLB 59,337 tps/node (6% below). Decode (9-node EP72, 2K input, batch 256): SGLang 22,282 tps/node vs. DeepSeek profile 18,598 tps/node on 16 nodes — SGLang at **half the nodes** achieving 20% higher per-node throughput. The gap to DeepSeek production numbers (14,800 tps/node on 18 nodes) stems primarily from MTP; simulated MTP recovers to 17,373 tps/node (6.6% below DeepSeek profile).
- **EPLB requires production workload statistics to be effective.** In-distribution data is essential; distribution shifts degrade balancing quality. Two practical strategies: larger batch sizes (reduce random fluctuations in expert usage) and periodic rebalancing (3-stage: disk preload → async device transfer via free DMA engines → device-to-device weight copy).
- **Known limitations at publish time:** TTFT 2–5 s and ITL ~100 ms (throughput-optimized, not latency-optimized); limited to 96 GPUs (sequence length constrained); MTP not fully integrated with DP Attention; EPLB evaluated on in-distribution data only; no Blackwell support.

## Visual observations

**Fig 1 — 96-GPU system architecture overview** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-001.png`)

![SGLang 96-GPU DeepSeek deployment architecture: 12 nodes × 8 H100, PD disaggregated, expert parallelism across nodes via InfiniBand](https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-001.png)

Top-level topology: prefill pool and decode pool occupying separate node groups, connected via InfiniBand, KV cache transferred across the boundary.

**Fig 2 — DP Attention + DP Dense FFN vs. EP sparse FFN layout** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-002.png`)

![Left: DP Attention + DP dense FFN communication pattern (reduce-scatter/all-gather instead of all-reduce). Right: EP MoE expert layout using DeepEP across devices.](https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-002.png)

Crystallizes the two-part parallelism design: uniform DP for attention + dense layers (no KV duplication), EP for sparse MoE layers.

**Fig 3 — PD disaggregation handshake and KV transfer flow** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-003.png`)

![Sequence diagram: decode server pre-allocates KV cache → signals prefill server → prefill runs forward pass → RDMA transfer to decode server → decode server runs token generation](https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-003.png)

Concrete implementation: non-blocking background-thread send/receive, RDMA queue pairs with scatter-gather elements, pluggable RDMA libraries (Mooncake, NIXL).

**Fig 6 — End-to-end throughput comparison (prefill + decode, 4 configurations)** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-006.png`)

![Bar chart comparing TP16 baseline vs PD+EP SGLang vs PD+EP+simulated MTP vs DeepSeek official profile, for both prefill (4-node) and decode (9-node) phases. SGLang decode at 9 nodes matches or exceeds DeepSeek profile at 16 nodes.](https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-006.png)

Headline throughput numbers for all configurations side by side. The decode column is the most striking: 9-node SGLang matches 16-node DeepSeek profile, confirming the EP72 + TBO configuration's efficiency.

- **Fig 4 — TBO launch-order diagram** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-004.png`) — prefill timeline showing computation submitted before CPU-blocking dispatch, eliminating GPU idle bubble. Load-bearing for the "proper launch order" claim.
- **Fig 5 — EPLB balancedness simulation at scale** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-005.png`) — GPU utilization (mean/max compute ratio) vs. node count with and without EPLB; confirms utilization degrades with scale and EPLB recovers it significantly. (Numbers in Key claims; image adds the scaling trend shape.)
- **Fig 12 — EPLB throughput impact** (`https://hirono-wiki.litenext.digital/raindrop/lmsys.org/2025-09-05-deploying-deepseek-with-pd-disaggregatio/lmsys-img-012.png`) — bar chart: 1.49× prefill / 2.54× decode speedup from EPLB. Supporting visualization for the speedup claims in Key claims.

*Other images decorative or supporting — TBO ablation charts (img-009–011), kernel breakdowns (img-007–008), expert distribution stats (img-014), balancedness-vs-throughput scatter (img-013) contain numbers already extracted above.*

## What this changes

- **Closes the "matching DeepSeek's throughput requires DeepSeek's proprietary stack" assumption.** The SGLang implementation achieves near-parity at half the node count for decode, open-sourced with full reproduction instructions at sgl-project/sglang issue #6017.
- **Identifies DeepEP dispatch-mode incompatibility as the root reason PD disaggregation is necessary** (not just beneficial) for large-scale MoE serving — unified scheduling cannot support both normal and low-latency dispatch simultaneously, which blocks DP Attention + CUDA Graph co-deployment.
- **EPLB's 2.54× decode speedup at large EP scale** establishes load balancing as the dominant single optimization lever for multi-node MoE serving, outweighing kernel-level gains at scale.

## Entities touched

[[SGLang]], [[DeepSeek]], [[MLA]], [[MoE]], [[NVIDIA]], [[H100]], [[Hopper]], [[DeepSeek-R1]]

## Topics touched

[[Inference Disaggregation]], [[MoE Serving]]

## Raw source

[lmsys.org/blog/2025-05-05-large-scale-ep/](https://lmsys.org/blog/2025-05-05-large-scale-ep/) — blog post, SGLang Team, May 5, 2025. 14 images (lmsys-img-001 through -014). Read 2026-05-15.
