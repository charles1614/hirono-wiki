---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Kernel Authoring

## What

The discipline of writing performance-critical GPU kernels — by hand or via DSLs.

## Current understanding

No sources have been ingested for this topic yet. The stub below captures the domain framing so the section is meaningful once sources accumulate.

---

**Kernel authoring** is the practice of writing performance-critical compute kernels — functions that run massively in parallel on GPU (or other accelerator) hardware. The discipline sits at the intersection of numerical computing, hardware micro-architecture, and software engineering, and is the primary lever for squeezing throughput out of AI training and inference workloads.

Two broad approaches exist. **Hand-written kernels** in CUDA or HIP give the author full control over memory layout, warp synchronization, and instruction scheduling, at the cost of portability and maintenance burden. **DSL-based authoring** (Triton being the dominant example in the ML ecosystem) raises the abstraction level: the programmer describes tiled, blocked computations and the compiler handles register allocation, shared-memory banking, and pipeline scheduling — often reaching 80–95 % of hand-tuned CUDA throughput with a fraction of the code.

The load-bearing primitives shared by both approaches are: **tiling** (decomposing a large problem into blocks that fit in fast on-chip SRAM/shared memory), **memory coalescing** (ensuring adjacent threads access adjacent memory addresses to maximize DRAM bandwidth), **occupancy** (keeping enough warps in flight to hide memory latency), and **instruction-level parallelism** (pipelining loads with compute). Mis-tuning any of these typically causes a factor-of-2 to factor-of-10 regression relative to roofline-model peak.

Key tension in the field: **programmability vs. performance portability**. A kernel hand-tuned for H100 SXM5 (with its 80 MB L2, 3.35 TB/s HBM3, and 989 TFLOPS BF16 tensor throughput) will often regress on A100 or MI300X without re-tuning. DSLs help by making the tile sizes and pipeline depths first-class parameters subject to auto-tuning, but the search space is large and hardware-specific. Compiler-driven approaches (XLA, Inductor) go further by eliminating manual kernel authoring entirely for standard operator patterns, at the cost of losing fine-grained control for novel or fused operations.

Operator fusion is where hand or DSL kernels justify their complexity: a fused FlashAttention kernel avoids materializing the full N×N attention matrix in HBM, cutting memory bandwidth by an order of magnitude relative to unfused softmax + matmul chains. The same pattern — identify a bandwidth bottleneck, fuse the producer and consumer into one kernel, keep intermediates in registers or shared memory — recurs across LayerNorm, RoPE, and mixture-of-experts routing.

Sources on specific kernels (FlashAttention variants, Triton tutorials, CUTLASS, cuBLAS internals) will populate this section with concrete benchmark figures and design choices once ingested.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
