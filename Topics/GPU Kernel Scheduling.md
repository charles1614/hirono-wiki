---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 5
---

# GPU Kernel Scheduling

## What

How CUDA kernels are scheduled at instruction and warp level — pipelining, async copies, warpgroup interleaving.

## Current understanding

GPU kernel scheduling operates at two distinct levels: the **hardware warp scheduler** (instruction-level, per SM) and the **software/driver-level kernel queue** (device-level, across SMs). Most performance-critical literature focuses on the former.

**Warp-level scheduling** is the primary mechanism inside a streaming multiprocessor (SM). Each SM hosts a pool of resident warps (32 threads each); the warp scheduler selects a ready warp every cycle and issues its next instruction. Latency hiding is the core goal — when a warp stalls on a memory load or a dependent instruction, the scheduler switches to another ready warp at zero cost, keeping the execution pipelines occupied. The number of resident warps needed to fully hide latency is determined by the arithmetic and memory latency of the kernel's instruction mix (the **occupancy** model).

**Pipelining within a warp** follows the instruction pipeline of the SM: decode → issue → execute → writeback. For independent instructions within a single warp, the scheduler can issue subsequent instructions before earlier ones complete (dual-issue on some architectures), so instruction-level parallelism inside a warp is partially exploitable. However, RAW (read-after-write) hazard latencies (e.g. 4–6 cycles for FP32 ALU, 20–80+ cycles for L1 cache hits, 400–800+ cycles for DRAM) constrain how quickly a warp can advance its own instruction stream.

**Asynchronous copies** (`cp.async` / `TMA` on Hopper+) decouple data movement from the warp's execution timeline. A warp issues an async copy into shared memory and immediately proceeds to other independent work; a `cp.async.wait` barrier synchronizes before the data is consumed. This breaks the tight coupling between global-memory latency and warp stall time, enabling software-pipelined loops where one stage of data is loaded asynchronously while the prior stage is computed — the **double-buffer / ping-pong** pattern.

**Warpgroup interleaving** (introduced formally in Hopper's wgmma / TMA programming model) extends this further: multiple warpgroups within a cooperative thread array (CTA) alternate between producer and consumer roles across pipeline stages. One warpgroup issues async copies via TMA; another warpgroup issues matrix-multiply instructions (wgmma) on the previously loaded tile. The scheduler interleaves the two warpgroups' instruction streams across the SM's pipelines, so neither the memory subsystem nor the tensor core units sit idle between stages. This pattern underpins FlashAttention-3 and other Hopper-optimized kernels.

**Device-level scheduling** (across SMs) is simpler: CUDA's hardware scheduler assigns thread blocks to SMs as SMs become free. Block assignment order is deterministic within a single launch but not guaranteed across launches. Stream-based concurrency allows multiple kernels to overlap on the device when they share independent streams and there are sufficient idle SMs, but fine-grained interleaving within a single SM between two independent kernels is not supported in the baseline execution model (each SM runs blocks from at most a small number of kernels simultaneously via MPS or spatial partitioning).

The key design tension is **occupancy vs. resource pressure**: more resident warps improve latency hiding but increase register file and shared memory pressure per SM, which can reduce the number of blocks that fit. Tuning kernel launch parameters (block size, register capping, shared memory carveout) is a search over this tradeoff surface, typically guided by the CUDA occupancy calculator or Nsight Compute's roofline analysis.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

## Observations

- CUDA-L2 (arXiv:2512.02551) leveled-optimization framework maps kernel scheduling awareness to optimization levels: Level 1 requires tiling and shared memory staging; Level 2 requires warp and [[Tensor Core Programming]] awareness; the LLM feedback pool gates higher-level hints until lower-level prerequisites are met. — [[2026-03-12-你的-llm-写-cuda-还停留在-level-0-吗-小红书]]
