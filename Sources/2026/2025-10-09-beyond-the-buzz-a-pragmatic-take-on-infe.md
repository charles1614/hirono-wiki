---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2506.05508
tags: [inference, disaggregation, nvidia, deepseek, llama, parallelism, kv-cache]
---

# [2025-10-09] Beyond the Buzz: A Pragmatic Take on Inference Disaggregation

## TL;DR

[[NVIDIA]] paper (arXiv:2506.05508, Jun 2025) — "first systematic study of disaggregated inference at scale," simulating **hundreds of thousands of design points** to map the throughput-vs-interactivity Pareto frontier for prefill-decode-split LLM serving on [[Blackwell]]+[[NVFP4]]. The honest title-bearing finding: **disaggregation is NOT a universal win.** It helps most when (1) traffic is prefill-heavy (ISL ≫ OSL), (2) models are large (>10B params), (3) dynamic rate matching adapts ctx:gen ratio to the SLA. For small models or generation-heavy traffic, co-located piggybacked serving wins. A reset against the 2025 hype cycle around disaggregation.

## Key claims

- **The setup.** Co-located serving runs prefill + decode on one model instance, batches them together via in-flight-batching ([[IFB]]) + piggybacking (context chunking). Disaggregated serving splits them onto separate GPU pools, each with independent parallelism + batching strategies.
- **Why disaggregate.** Co-located is forced to simultaneously optimize for low FTL (First Token Latency) and low TTL (Token-to-Token Latency) — two different bottlenecks. Disaggregated frees each pool to tune for its own SLA. But the search space gets expensive.
- **Two-axis optimization.** (1) model partitioning — TP, EP, PP, CPP (Chunked Pipeline Parallelism), TEP (Tensor-Parallel attention + EP FFNs); (2) rate matching — ratio of prefill to decode GPUs.
- **CPP (Chunked Pipeline Parallelism) is the key prefill technique.** Splits context into smaller chunks, processes each chunk independently using KV from prior chunks (but not their outputs), overlaps earlier-layer of new chunks with later-layer of previous via pipeline parallelism. Cuts FTL while preserving throughput; better than wide TP for long contexts.
- **Model architecture matters.** DeepSeek-R1's [[MLA]] hits a specific piggybacked-co-located penalty: down/up-projection KV recomputation per prefill chunk. Fixable by caching up-projected KV from earlier chunks. Affects DeepSeek-R1 in particular; not Llama-3.1-70B (which uses [[GQA]]).
- **Larger models benefit more from disaggregation.** Tested on Llama 8B / 70B / 405B: the gain over co-located widens with size, because larger models are sharded across more GPUs → richer parallelism search space → bigger payoff from optimizing prefill and decode separately.
- **Traffic is the decisive variable.** Prefill-heavy workloads (e.g., ISL=256k, OSL=2k) gain most from disaggregation. Decode-heavy traffic — piggybacked co-located wins.
- **Dynamic rate matching is required.** Static ratios (3.5:1, 0.5:1, etc.) are Pareto-optimal only for one latency regime each; a 3.5 ratio is great at relaxed-latency targets but degrades sharply under tight TTL. Production deployments need to adapt ctx:gen ratio per-SLA.
- **NVLink domain size matters.** Larger NVLink domains widen the EP/TP options for decode → consistently better disaggregated performance.
- **KV transfer bandwidth is not the bottleneck.** Analytically derived per-GPU egress (prefill side) + ingress (decode side) bandwidth requirements — "existing provisioned datacenter bandwidth is sufficient." Egress bandwidth *decreases* as ISL grows (FTL scales superlinearly while KV scales linearly). Important counter to the intuition that KV transfer is the constraint.
- **Methodology**: proprietary high-fidelity GPU performance simulator (not real-hardware measurements). Inputs = model arch + traffic pattern + GPU config → outputs latency/throughput across batch sizes + parallelism strategies. Most results normalized — paper signals trends, not absolute numbers.

### KV cache transfer bandwidth (eq. 1 + 2 reproduced)

The two formulas are the cleanest single takeaway from §5.1 for an operator sizing a disaggregated deployment:

| Direction | Formula | Drivers |
|---|---|---|
| Prefill-side egress | `BW_egress = N_layers × BS_prefill × ISL × d_head × N_kvheads × bytes_elem / (FTL × N_GPU_prefill)` | Scales with model layers, batch, ISL; inversely with FTL + prefill GPUs |
| Decode-side ingress | `BW_ingress = N_layers × BS_decode × ISL × d_head × N_kvheads × bytes_elem / (TTL × OSL × N_GPU_decode)` | Adds OSL in denominator → tighter TTL widens, but more OSL shrinks |

## Visual observations

**Fig 1 — Pareto frontier for DeepSeek-R1** (load-bearing — this is the paper's headline visual)

![Pareto frontier — prefill-heavy traffic (left panel) shows disaggregation dominates co-located; generation-heavy (right panel) ties](../../raw/raindrop/arxiv.org/2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe/2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe-figures/figure-001.png)

Two panels: prefill-heavy traffic (left, ISL 16384 OSL 2048) vs generation-heavy (right, ISL 1024 OSL 32768). Disaggregation (blue Pareto curve) dominates co-located piggybacked (red) in the left panel; basically ties in the right panel. **This single image is the core "disaggregation is not universal" argument** — without seeing the two-panel disparity, the conclusion reads like equivocation.

- **Fig 7 — Llama 8B/70B/405B disaggregated vs co-located** — Widening gap as model size grows; 405B panel has the most-dramatic disaggregation advantage. See PDF for exact page. Supporting (claim is in Key Claims).
- **Fig 9 — Optimal ctx:gen ratio across models + latencies** — What "dynamic rate matching" hangs on. Single-ratio policies leave performance on the table. See PDF. Supporting.

## Entities touched

[[NVIDIA]], [[Blackwell]], [[NVFP4]], [[DeepSeek]], [[Llama]], [[Megatron-LM]], [[MLA]], [[GQA]], [[Mooncake]], [[DistServe]], [[Sarathi-Serve]], [[NVLink]]

## Topics touched

[[Inference Disaggregation]], [[LLM Inference Systems]], [[Parallelism Strategies]], [[KV Cache Management]]

## Open questions

- Simulator-only methodology. The numbers are simulated by an NVIDIA-internal high-fidelity tool, not measured on a real Blackwell cluster. How well do the predictions hold under real network jitter, KV-transfer queuing, scheduler overhead?
- **Chunked Pipeline Parallelism (CPP)** is the post's most concrete novel technique but isn't formally compared against alternatives (e.g., sequence parallelism, prefill speculation). When does CPP lose to other long-context-prefill strategies?
- "Optimization space is expanding rapidly" — listed future work: KV cache reuse, speculation, inference-time compute, model architecture evolution. KV cache reuse in particular interacts with [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] (vLLM's KVConnector + NIXL is precisely the reuse infrastructure being built in production). The two papers should reconcile.
- The MLA-specific piggybacking penalty (down/up projection recomputation) — is the proposed fix (cache up-projected KV from earlier chunks) already in DeepSeek's open inference stack (cross-ref [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]])? FlashMLA's "seesaw" schedule solves a different MLA problem (compute-bound decode); this is about prefill.
- **NVFP4 as the precision floor**: the paper assumes Blackwell + FP4 throughout. How do conclusions shift on Hopper + FP8 (the more common production setting)? Cross-ref [[2026-02-04-pretraining-large-language-models-with-n]].
- Reference [7] (P/D-Serve) is one of the prior implementations; the survey paper [[2026-05-08-a-survey-of-llm-inference-systems]] presumably covers all of these. Worth cross-reading.

## Raw source

[arxiv.org/abs/2506.05508](https://arxiv.org/abs/2506.05508) — 15-page paper, full PDF preserved at `raw/raindrop/arxiv.org/2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe/2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe.pdf` (1.4 MB) and per-page renderings under `*-images/page-NNN.png`. Authors: Tiyasa Mitra, Ritika Borkar, Nidhi Bhatia, Ramon Matas, Shivam Raj, Dheevatsa Mudigere, Ritchie Zhao, Maximilian Golub, Arpan Dutta, Sailaja Madduri, Dharmesh Jani, Brian Pharris, Bita Darvish Rouhani (NVIDIA).
