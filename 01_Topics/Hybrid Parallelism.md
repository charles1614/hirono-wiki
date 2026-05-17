---
created: 2026-05-12
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 5
---

# Hybrid Parallelism

## What

Combining multiple parallelism dimensions (TP × EP × CP × DP × PP) for very-large-scale training.

## Current understanding

Very-large-scale training (hundreds of billions to trillions of parameters, thousands of GPUs) cannot be served by any single parallelism axis. **Hybrid parallelism** is the systematic composition of multiple independent partitioning strategies — most commonly **Tensor Parallelism (TP)**, **Pipeline Parallelism (PP)**, **Data Parallelism (DP)**, **Expert Parallelism (EP)**, and **Context Parallelism (CP)** — into a single training job, with each axis mapped to a distinct communication group over the device mesh.

The canonical factorization treats the global device count as a product: `world_size = TP × PP × EP × CP × DP`. Each axis imposes its own communication pattern and bandwidth requirement. TP requires all-reduce (or reduce-scatter + all-gather) within a node at near-NVLink bandwidth; PP requires point-to-point sends across pipeline stages, tolerating higher latency; DP requires all-reduce or all-gather across replicas and is bandwidth-bound but latency-tolerant; EP scatters tokens to expert-assigned GPUs via all-to-all; CP partitions the sequence dimension for long-context workloads using ring-attention. Efficient hybrid schedules interleave these communications to maximize overlap with compute.

The **4D parallelism** framing (TP × PP × CP × DP, with EP layered on top for MoE) emerged as the de-facto recipe for frontier-scale dense and mixture-of-experts models. The key insight is that TP is bandwidth-constrained and scales poorly beyond a single node boundary, so TP degree is typically set to the NVLink domain size (8 on H100 DGX nodes). PP degree spans nodes and absorbs the remaining depth at the cost of pipeline bubbles, which micro-batching and interleaved schedules mitigate. DP (including ZeRO-style sharded DP) then scales to the remaining cluster width.

**Scheduling** is the hard problem that hybrid parallelism exposes. The 1F1B (one-forward-one-backward) pipeline schedule reduces the bubble fraction from `(PP−1)/PP` toward `1/m` where `m` is the number of micro-batches, but it is a sequential schedule. Interleaved and "virtual stage" variants (e.g., Megatron-LM's interleaved 1F1B) further reduce bubbles by having each device own multiple non-contiguous pipeline stages. More recent work (breadth-first pipelines, zero-bubble schedules) attempts to eliminate the bubble entirely by decoupling forward and backward passes across micro-batches.

The **communication–compute overlap** design principle is load-bearing across all axes. TP all-reduces can be overlapped with the non-TP-partitioned part of the same layer's compute; DP gradient all-reduces can be overlapped with the backward pass of subsequent micro-batches. EP all-to-all dispatches are harder to overlap because they are on the critical path between the attention and FFN sub-operations. CP ring-attention is structured so that each device can compute its local attention block while the KV tensors are in-flight to the next ring neighbor. Whether these overlaps actually hide latency depends on the achieved bandwidth fraction (typically 70–90% of peak NVLink, 40–70% of peak IB).

No single axis combination dominates universally. The optimal TP × PP × EP × CP × DP assignment is a function of model architecture (layer count, hidden size, number of experts, sequence length), hardware topology (NVLink bandwidth, IB bandwidth, per-GPU memory), and batch-size constraints (global batch size fixes DP × micro-batch-size × gradient-accumulation-steps). Practitioners typically grid-search or use analytical models (e.g., roofline projections) over a small TP/PP/CP subspace and fix DP to fill remaining capacity.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
