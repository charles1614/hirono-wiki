---
created: 2026-05-12
updated: 2026-05-13
synthesis_updated_at: 2026-05-13
type: topic
source_count: 1
---

# GPU Programming Models

## What

Abstractions above SIMT for authoring GPU code — CUDA, CUDA Tile, Triton, CUTLASS, cuTile Python.

## Current understanding

GPU programming models form a layered abstraction stack sitting above raw hardware ISA and SIMT execution. At the base, **CUDA C/C++** exposes the hardware directly: grids of thread-blocks, shared memory, warp-level primitives, and PTX intrinsics. Writing high-performance CUDA requires manual orchestration of tiling, register allocation, async memory copies (TMA/cp.async), and warp scheduling — tractable for library authors but hostile to ML researchers who need fast iteration.

**Triton** occupies the middle of the stack. Its core abstraction is the *tile* — a statically-sized 2-D block of values that maps onto a warp group or CTA. The programmer writes scalar-looking loops over tiles; the compiler (MLIR-based) handles register layout, vectorization, shared-memory staging, and scheduling automatically. This makes attention kernels, matmul variants, and fused activation functions writable in ~100 lines of Python instead of 1 000 lines of CUDA, at 80–95 % of hand-tuned throughput on common shapes. Triton's weakness is expressiveness at the extremes: non-rectangular tiles, fine-grained warp specialization, and producer–consumer pipelines between warp groups are difficult or impossible to express.

**CUTLASS** (and its successor **CuTe**) target the other end of the spectrum: maximal performance for dense linear algebra on NVIDIA hardware. CuTe introduces a *layout algebra* — composable rank-polymorphic descriptors for strides, tiling hierarchies, and register vs. shared memory placement — that makes it possible to write a single generic kernel that compiles correctly for GEMM, batched GEMM, grouped GEMM, and attention with different tile sizes, precisions, and hardware generations. CUTLASS 3.x restructures the pipeline around *warp-group MMA* and *TMA* copy engines, separating the producer (data fetch) and consumer (math) roles explicitly. The programming model is expressive and composable but carries a steep learning curve: CuTe layouts are a DSL within C++ that requires understanding the mapping from logical coordinates to physical addresses for every level of the memory hierarchy.

**CUDA Tile** (the cuTile / `cuda::ptx` library direction from NVIDIA) aims to surface TMA and warp-group MMA as first-class C++ objects, narrowing the gap between raw CUDA and CuTe without requiring the full layout-algebra machinery. The intent is to let a programmer express *what* gets copied and *when* (using async pipeline barriers) while the library generates the correct PTX. cuTile Python (the Python bindings layer) brings this down to a scripting surface, making it accessible alongside Triton for prototyping persistent kernels and pipelined attention variants.

The practical division of labor as of 2026: Triton is the default for new ML kernels (fused attention, custom activations, mixture-of-experts routing); CUTLASS/CuTe remains authoritative for GEMM and anything requiring sub-1 % headroom against roofline; cuTile/CUDA Tile is an emerging middle path for structured pipelined kernels that need more control than Triton but less boilerplate than raw CuTe. All three compile through LLVM/NVCC to the same PTX/SASS layer — they differ in what invariants the programmer must state explicitly versus what the compiler or library infers.

A persistent tension across the stack is **tile-size portability**: a Triton kernel tuned for H100 (with 80 SM × 128-thread warp groups) may need retuning or even rewriting for B200 (with 4-SM partitioned SM clusters and NVLink-Switch memory). CUTLASS addresses this with its template hierarchy; Triton addresses it with auto-tuning configurations; cuTile Python is too new for established guidance. Sources are expected to clarify how the cuTile Python abstraction handles multi-CTA cluster tiling as that work matures.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
