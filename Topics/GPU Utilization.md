---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# GPU Utilization

## What

Measuring and improving the fraction of GPU peak compute / memory bandwidth actually delivered on a workload.

## Current understanding

**GPU utilization** is the fraction of a GPU's peak theoretical compute (FLOP/s) or memory bandwidth actually delivered on a given workload. These two axes — **compute utilization** and **memory-bandwidth utilization** — are almost never maximized simultaneously; a workload is either compute-bound or memory-bound, and diagnosing which determines the correct optimization lever.

The canonical diagnostic is the **roofline model**: plot achieved FLOP/s against arithmetic intensity (FLOPs per byte of DRAM traffic). A workload to the left of the ridge point is memory-bandwidth-bound; one to the right is compute-bound. Modern LLM inference is almost always memory-bandwidth-bound during the **decode** phase (one token generated per step, matrix-vector products) and can be compute-bound during **prefill** (full sequence processed in one pass, matrix-matrix products). Training is typically compute-bound when batch size and sequence length are large enough to saturate the tensor cores.

**MFU (Model FLOP Utilization)** has become the standard efficiency metric for large-model training: achieved useful FLOP/s divided by the GPU's peak BFLOAT16 FLOP/s. Reported MFU for well-optimized transformer training runs on H100s ranges roughly 35–55%, with the gap from 100% accounted for by all-reduce communication, activation recomputation overhead, data-loading stalls, and memory-copy latency. **HFU (Hardware FLOP Utilization)** counts recomputed activations as "real" FLOPs and is always higher than MFU; MFU is the preferred metric because it reflects useful work per dollar.

The main levers for improving utilization fall into four categories. (1) **Operator fusion** — combining elementwise ops, layer norms, and attention into single kernels (FlashAttention, fused softmax) eliminates redundant DRAM round-trips. (2) **Quantization** — INT8/FP8 weights and activations reduce memory pressure, shifting the roofline ridge point and enabling higher arithmetic intensity. (3) **Batching and sequence packing** — larger effective batch sizes amortize weight-load cost across more tokens; packing variable-length sequences into fixed-length chunks removes padding waste. (4) **Parallelism layout** — tensor, pipeline, and sequence parallelism determine how much of the chip's compute is exposed vs. spent on communication; pipeline bubble fraction and all-reduce volume are first-order utilization taxes.

**Memory bandwidth** is the dominant bottleneck for inference at small batch sizes. The KV cache scales with batch size × sequence length × layers × head dimension, and at long contexts it can consume the majority of HBM capacity, forcing smaller batches and further degrading utilization. Techniques like **GQA (Grouped Query Attention)**, **MLA (Multi-head Latent Attention)**, and **KV cache quantization** directly attack this bottleneck by shrinking the memory footprint per request.

Profiling tools (NVIDIA Nsight Systems, PyTorch Profiler, `ncu` / `nvtx` markers) expose the kernel-level breakdown: SM occupancy, L2 cache hit rate, DRAM BW utilization, and warp stall reasons. A common finding is that SM occupancy is high yet FLOP/s is low — indicating stalls on memory latency rather than insufficient parallelism, which points to fusion or cache-tiling fixes rather than launch-config changes.

There is broad agreement that **wall-clock MFU of 40–50% is a reasonable production target** for well-tuned large-model training; numbers below 30% usually indicate a fixable bottleneck (pipeline bubbles, data-loading, unoptimized attention). For inference, the relevant metric shifts to **tokens-per-second-per-dollar** or **time-to-first-token**, which fold in batching efficiency and hardware cost alongside raw compute utilization. The field has not yet converged on a single inference-utilization metric analogous to MFU.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
