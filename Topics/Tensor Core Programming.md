---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# Tensor Core Programming

## What

Authoring code targeting NVIDIA's matrix-multiply units — MMA, WGMMA instructions and their precision/shape constraints.

## Current understanding

Tensor Cores are NVIDIA's dedicated matrix-multiply-accumulate (MMA) units, first introduced in Volta (V100) and substantially extended through Ampere and Hopper generations. They operate on fixed-size matrix tiles in hardware, bypassing the general CUDA SIMT pipeline for the inner compute loop. The programming surface for Tensor Cores has evolved through three distinct generations of instruction families: the original `wmma` (warp-level matrix multiply-accumulate) API in CUDA C++, the lower-level PTX `mma` instruction (Ampere and earlier), and the Hopper-generation **WGMMA** (warpgroup MMA) instructions that operate on 128-thread warpgroups and expose the full sm_90 matrix engine.

**MMA instructions** (`mma.sync.aligned.*`) are warp-collective: all 32 threads in a warp participate, each holding a fragment of the A, B, or C/D tile in registers. The instruction shape is encoded in the mnemonic — e.g. `mma.sync.aligned.m16n8k16.row.col.f16.f16.f16.f16` specifies tile dimensions (M=16, N=8, K=16), layout (row-major A, column-major B), and precision (fp16 in, fp16 accumulate). Supported shapes and precision combinations are tightly constrained per architecture: Ampere adds bf16 and tf32 operands; Hopper adds fp8 (e4m3/e5m2) with the `mma.sp` sparse variant and integer (int8/int4) paths for quantized inference.

**WGMMA** (Hopper, sm_90) is a qualitative shift: the instruction operates across a 128-thread warpgroup rather than a single warp, and it can source the A operand directly from shared memory (via a tensor map descriptor) rather than registers. This decouples the memory-fetch and compute pipelines and enables the **Tensor Memory Accelerator (TMA)** to stage data asynchronously while the MMA units run. The canonical WGMMA shape is `wgmma.mma_async.sync.aligned.m64n256k16.*`, where N can be 8–256 in multiples of 8, depending on precision. WGMMA instructions are asynchronous: the compute result is only visible after a `wgmma.wait_group` barrier, analogous to how `cp.async` requires `cp.async.commit_group` + `cp.async.wait_group` for shared-memory staging.

**Precision and accumulation trade-offs** are the central design choice when authoring MMA kernels. tf32 (Ampere+) rounds fp32 inputs to 10 mantissa bits before multiplication but accumulates in fp32 — a 2–8× throughput gain over fp32 at the cost of ~3 ULP error per operation, acceptable for most deep learning but not numerically sensitive scientific workloads. fp8 (Hopper) halves the register and bandwidth footprint versus fp16, enabling larger effective batch sizes, but requires explicit scaling factors (per-tensor or per-row) to avoid overflow in the e4m3 5-bit exponent range. Mixed-precision paths (fp8 in, fp16/bf16 accumulate) are the default pattern for LLM inference kernels on H100.

**Register layout and fragment ownership** are the most error-prone aspect of hand-authored MMA code. Each thread in the warp owns a non-contiguous subset of the logical tile, and the exact mapping (which thread holds which matrix element) is architecture-specific and not exposed as a simple strided slice. The CUDA `wmma::fragment` abstraction hides this; PTX `mma` requires the programmer to match the PTX ISA's thread-to-register mapping tables precisely, or the reduction will silently produce wrong results. CUTLASS and its successor **CuTe** (the layout algebra library now shipping with CUTLASS 3.x) solve this by encoding tile and thread layouts as composable `Layout` types, letting the compiler verify shape compatibility at compile time.

**CUTLASS / CuTe** is the reference programming model for production Tensor Core kernels. CuTe's `TiledMMA` abstraction wraps the underlying PTX atom (e.g. `SM90_64x256x16_F16F16F16F16_SS` for a Hopper WGMMA atom), composes it with tiling and partitioning layouts, and generates the register-assignment and instruction-sequencing code. This separates *what* the MMA computes (atom shape + precision) from *how* the tile is partitioned across warps and pipeline stages — enabling a single kernel template to target sm_80 (Ampere `mma`), sm_89 (Ada), or sm_90 (WGMMA) by swapping the atom.

**Pipeline staging** (software pipelining of GEMM mainloops) is the other load-bearing primitive. The standard pattern is a K-dimension loop that interleaves TMA prefetch for the next K-block with WGMMA computation on the current K-block, using a circular shared-memory pipeline of depth 2–8. Depth is constrained by shared-memory capacity (each stage holds the A and B tiles for one K-block) and register pressure (holding more pipeline slots requires more accumulator registers). The Hopper `warpgroup` model further subdivides this: one warpgroup runs the WGMMA producer loop, another runs the epilogue (e.g. scale + store), overlapped via `arrive/wait` on named shared-memory barriers.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
