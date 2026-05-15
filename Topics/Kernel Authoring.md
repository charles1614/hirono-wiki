---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 3
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

**Agent-driven kernel optimization** is rapidly becoming a primary delivery vector. The GiantPandaLLM author ([[2026-03-24-记录下sglang开发-优化-debug的技巧之大skill时代已来临]]) reports that Codex + GPT5.4 Extra High under SGLang's SKILL pattern delivered single-card speed gains of 40% on Z-Image and 20%+ on Qwen/Qwen-Image-2512 in approximately two weeks — work volume that previously required sustained expert effort. The AKO4ALL framework (github.com/TongmingLAIC/AKO4ALL), specialized for kernel optimization workflows, demonstrated an additional 2 percentage-point end-to-end gain after ~40 minutes of autonomous search, without human-in-the-loop iteration. The practical lesson: SKILL quality (clarity of goal, richness of context, rigor of validation criteria) is the binding constraint on agent-driven kernel authoring — not model capability per se.

**SGLang's `jit_kernel` abstraction layer** ([[2026-03-16-sglang-claude-skills-add-jit-kernel-skil]]) is an instructive case study in how a production inference framework institutionalises kernel authoring conventions. Three design decisions stand out: (1) **project-managed abstraction headers** (`TensorMatcher`, `AlignedVector`, `LaunchKernel`) mandate that every kernel uses validated, codebase-consistent building blocks rather than raw CUDA primitives — the constraint is enforced by a SKILL document that agents (not just humans) read and execute; (2) **JIT vs AOT decision tree** is a first-class architectural concern: lightweight kernels use first-use JIT compilation for rapid iteration; CUTLASS-dependent kernels go through the wheel-built AOT path to avoid build-system overhead; (3) **PDL (Programmatic Dependent Launch, SM90+)** and persistent-kernel occupancy patterns are explicitly taught as opt-in performance techniques, signalling that the framework targets Hopper/Blackwell at the kernel level. The benchmark layer (Triton's `perf_report` harness comparing JIT vs `torch`) establishes a repeatable measurement discipline alongside correctness tests.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
