---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Kernel Fusion

## What

Combining multiple operations into a single GPU kernel to eliminate intermediate memory traffic and stream-scheduling overhead.

## Current understanding

**Kernel fusion** is the practice of collapsing multiple GPU operations that would otherwise execute as separate kernels into a single kernel launch, so that intermediate results live in registers or shared memory rather than being written to and read back from global (DRAM) memory. The central motivation is that modern GPUs are memory-bandwidth-bound for many deep-learning workloads: an unfused sequence of elementwise operations (add → ReLU → dropout → layer-norm) each touches the full activation tensor in DRAM, whereas a single fused kernel reads the tensor once, performs all operations on-chip, and writes once.

The two load-bearing primitives are **memory-traffic elimination** and **launch-overhead elimination**. Memory traffic dominates for elementwise and reduction operations whose arithmetic intensity (FLOPs per byte) is low; fusion raises that ratio by amortizing the DRAM round-trip across multiple operations. Launch overhead (kernel dispatch latency, stream-scheduler scheduling, synchronization barriers) is typically in the 5–20 µs range per kernel on modern hardware; sequences of hundreds of small kernels accumulate this into measurable wall time even when each kernel is individually fast.

Fusion applies unevenly across operation types. **Pointwise (elementwise) chains** fuse almost without constraint because each output element depends on only the corresponding input elements — there are no cross-element dependencies that require synchronization. **Reductions** (softmax, layer-norm, sum) are harder: they require a two-pass structure (partial reduce → broadcast) that crosses thread-block boundaries, so fusion must be designed around those synchronization points. **Matrix multiplications** (GEMMs) generally do not fuse with each other because their arithmetic intensity is already high and tiling strategies conflict; the common pattern is to fuse the GEMM's epilogue (bias-add, activation) rather than fuse two GEMMs.

In practice, kernel fusion is delivered via three mechanisms. **Compiler-driven fusion** (torch.compile / Triton / XLA) automatically detects fusible subgraphs in the computation graph and emits fused kernels, sometimes using autotuning to select tile sizes. **Hand-written kernels** (FlashAttention being the canonical example) fuse operations that compilers cannot yet fuse automatically — FlashAttention fuses the QK^T matmul, softmax, and AV matmul into a single tiled pass that keeps the attention matrix in SRAM, reducing the memory complexity of attention from O(n²) to O(n) in DRAM traffic. **Library-provided fused ops** (cuDNN, CUTLASS epilogue fusions) offer pre-tuned fused implementations for common patterns such as GEMM + bias + activation.

The primary limitation is **register pressure**: a fused kernel that performs many operations per thread needs more registers, which reduces GPU occupancy (the number of warps that can be resident simultaneously). Compilers and kernel authors must balance fusion depth against occupancy loss. A second constraint is **shared-memory capacity**: tiled algorithms like FlashAttention rely on fitting tiles in shared memory; fusing additional operations into the same kernel competes for that budget. These constraints mean that optimal fusion is workload- and hardware-specific, which is why autotuning is standard practice in frameworks like Triton.

No Sources have been cited for this topic yet. The understanding above reflects consensus across the ML systems literature; it should be updated with inline `<source-slug>` attributions as Sources are added.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
