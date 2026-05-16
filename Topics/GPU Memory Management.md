---
created: 2026-05-15
updated: 2026-05-16
type: topic
source_count: 15
---

# GPU Memory Management

## What

How GPU memory is allocated, profiled, and estimated for deep-learning workloads — covering the five memory zones of a training loop, tooling for visibility, and estimation formulas for pre-run capacity planning.

## Current understanding

GPU memory during a [[PyTorch]] training loop decomposes into five named zones: **model parameters** (blue; static across iterations), **forward-pass activations** (orange; grow layer-by-layer, retained until the next forward pass overwrites them), **gradients** (yellow; accumulate during backward), **optimizer state** (green; initialized once per run — for [[AdamW]] this is two moments per parameter, so 2NP bytes), and **optimizer intermediates** (red; transient during the update step). The peak depends on batch size: large batches peak during the forward pass (parameters + optimizer state + activations); small batches peak during the optimizer step (parameters + optimizer state + gradients + optimizer intermediates). The general formula:

\\( \text{Total} = 3NP + \max(NP,\ A \times B \times L \times P) \\)

where N = parameter count, P = bytes per parameter, A = activations per token, B = batch size, L = sequence length.

[[PyTorch]] ships a first-party profiler: `torch.cuda.memory._record_memory_history` + `_dump_snapshot` produces a `.pkl` that [pytorch.org/memory_viz](https://pytorch.org/memory_viz) renders as an interactive timeline — useful for identifying which zone is driving OOM events. Activations per token can be measured via forward hooks; empirically, A ≈ 4.69 × 10⁻⁴ × N + 1.85 × 10⁶ across several LLMs, giving a practical pre-run heuristic. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]

## Open threads

## Observations

- [[Megatron-LM]] TP activation memory: without SP, activation per layer ≈ `batch × seq × hidden × 34 × num_layers`; with SP (`sequence_parallel=True`), reduces by ~1/TP for LayerNorm/Dropout activations (~30% total at TP=8). Llama-3 70B at TP=4: 17.5B params/GPU = 35 GB FP16 + 210 GB AdamW optimizer state before ZeRO sharding. — [[2026-01-28-deepwiki-megatron-lm-05-tensor-paralleli]]
- [[H100]] memory hierarchy: register file (RMEM) has the same total capacity as L1+SMEM combined; L1/SMEM share physical storage with configurable split; L2 is physically partitioned into two halves each connected to half the SMs; "speed of light" for RMEM→SMEM is orders of magnitude faster than GMEM (HBM) — [[Aleksa Gordić]] deep-dive provides concrete capacity/latency/bandwidth figures. — [[2025-10-12-inside-nvidia-gpus-anatomy-of-high-perfo]]
- [[FlashMLA]] memory optimization hierarchy: FP8 KVCache (V32: 656 bytes/token; MODEL1: 512 bytes/token), DSM crossover (64% dequantization throughput improvement), paged KVCache (no fragmentation), TMA pipelining (overlap load+compute). Together enable practical 128K+ context on a single 80 GB GPU. — [[2026-01-30-deepwiki-flashmla-04-memory-management]]
- JAX Scaling Book Ch. 12 GPU memory hierarchy per SM (H100/B200): 256kB registers, 256kB SMEM (L1 cache), 50MB shared L2 (~5.5 TB/s measured full-duplex); HBM (3.35 TB/s / 80GB for H100, 8 TB/s / 192GB for B200). SMEM is programmer-controlled or used as on-chip cache; L2 is uncontrolled and shared across all 132 SMs ("spooky action at a distance"). TPU VMEM (128MB, ~40 TB/s) is 2× larger and substantially faster than GPU SMEM — a key advantage for inference weight-prefetch. B200 adds TMEM (256kB/SM) to hold TC accumulator that no longer fits in SMEM. — [[2025-12-11-how-to-think-about-gpus-how-to-scale-you]]
- CUDA VMM (CUDA 10.2+) decouples virtual address reservation from physical allocation: `cuMemAddressReserve` + `cuMemCreate` + `cuMemMap` enables in-place buffer growth without data copy; at 1 GB → 2 GB expansion, `cudaMalloc`-based vector requires 3 GB concurrent footprint vs VMM which reuses the VA range by mapping new physical blocks. Per-region P2P access via `cuMemSetAccess` replaces global `cudaDeviceEnablePeerAccess`. — [[2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par]]

- PyTorch 2.1 CUDA memory Snapshot three-view analysis: Active Memory Timeline (per-tensor lifetime + Python/C++ call stack), Allocator State History (CUDA segment → block alloc/free lifecycle; `block.free` is a torch-allocator release not `cudaFree`; `cudaFree` only fires on segment release), and Active Cached Segment Timeline (which operations trigger large segment creation). Memory fragmentation occurs when a new allocation exceeds the free space in existing segments, causing a new segment to be created. — [[2025-11-12-pytorch显存可视化与snapshot数据分析]]
- PyTorch memory snapshot 的 AMP 训练详解：forward 阶段 `autocast()` 上下文内 FP32 权重临时转 FP16 参与矩阵乘，FP32 主权重保留；backward 阶段 `GradScaler.scale(loss).backward()` 计算 FP16 梯度，`scaler.step()` 在更新前将 FP16 梯度转回 FP32；每个步骤的 segment 分配/复用/释放行为均可在 memory snapshot 的堆栈信息中追溯到源码行号。 — [[2025-09-22-如何利用pytorch-memory-snapshot进行显存分析]]

## Sources drawn on

- [[2025-11-12-pytorch显存可视化与snapshot数据分析]] — PyTorch 2.1 memory snapshot API usage, three visualization views, memory fragmentation mechanics, Profiler `export_memory_timeline`.

- Two interactive GPU memory calculator tools added to corpus: inference.ai (calculator.inference.ai) provides configurable architecture parameters to estimate model VRAM, KV cache, and training memory requirements with GPU compatibility lists; apxml.com VRAM calculator adds Chinese-language estimates with MoE misconception clarification (all experts must reside in VRAM regardless of MoE sparse activation). Both use approximate formulas — not exact due to framework-specific optimizations. — [[2025-07-24-gpu-calculator]] [[2025-07-24-vram-计算器-nvidia-gpu-与-apple-silicon]]
- CUDA 12.0 context-independent module loading (`cuLibrary*` / `cuKernel*` APIs): driver automatically manages module load/unload when contexts are created/destroyed; eliminates per-context `map<CUcontext, CUmodule>` state maintenance; shared memory used to pass TMEM base addresses across warps. Pre-12.0: each context required explicit `cuModuleLoad` per device. — [[2025-06-09-再议-driver-和-runtime-apis]]
- [[vLLM]] CPU weight offload (PR #6496, Jul 2024) uses pinned CPU memory + `non_blocking=True` async H2D copy + `torch.func.functional_call` to swap layer weights on the fly; `--cpu-offload-gb N` extends effective GPU memory capacity by N GB per device; pinned memory works correctly within CUDA graphs. GH200 empirical: loading 70B model with 70 GB offload took 8 min (vs 4 min 20 sec for alternative PR #6317). — [[2025-05-30-core-model-yet-another-cpu-offload-imple]]
