---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 5
---

# GPU Microarchitecture

## What

*Stub topic — to be expanded from sources.*

## Current understanding

GPU microarchitecture knowledge in this wiki currently centers on the Hopper (H100) generation, cross-compared against Ampere (A100) and Ada (RTX 4090/L40), via a systematic microbenchmark study [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]. The core insight is that Hopper's generational gains over Ampere are not primarily from higher clock speeds or raw IPC improvements — they come from three architectural additions that require programmer awareness to exploit: the **Tensor Memory Accelerator (TMA)**, **Distributed Shared Memory (DSM)**, and **DPX instructions**.

**TMA** enables asynchronous block-level copies between global and shared memory without occupying threads, building on Ampere's `cuda::memcpy_async`. Its payoff is compute/memory overlap — microbenchmarks show this kicks in at specific matrix dimensions and block sizes (tested 2048-element matrices, 8×8 to 32×32 blocks). **DSM** allows SMs within a thread block cluster to read, write, and atomically operate on each other's shared memory directly, reducing L2/HBM traffic for cooperative SM work. **DPX** accelerates dynamic-programming primitives in hardware (min/max over previously computed solutions); on earlier GPUs the CUDA 12+ API emulates this in software.

**Tensor Core precision evolution** across generations follows a clear accumulation pattern: Volta added FP16/FP32, Ampere added INT8/INT4/FP64/BF16/TF32 and structured sparsity, and Hopper adds **FP8** — the qualitatively important step for LLM training and inference. The microbenchmarks measure tensor-core instruction latency and throughput at each precision across all three generations, providing the undisclosed micro-architectural data sheet that NVIDIA's official specs omit.

The **Transformer Engine (TE) limitations** are a load-bearing practical finding: `te.Linear` is the only fully FP8-quantized operator path; Softmax and GeLU are not quantized to FP8 in the current TE, causing data-format-conversion overhead. Critically, `DotProductAttention` uses FlashAttention rather than FP8 Tensor Cores, so attention in TE does not benefit from FP8 at all. This explains why real LLM FP8 speedups fall short of the theoretical 2× over FP16 that peak tensor-core rates suggest. Benchmarks across LLaMA 7B (hidden=4096), 13B (5120), and 70B (8192) show the hidden-size sensitivity of these gaps.

The practical implication for workload designers: **pure FP16 compute workloads gain little from upgrading Ampere → Hopper**; workloads combining FP8 with heavy async data movement gain substantially. DPX hardware is present but underutilized by current LLM workloads — adjacent domains (speculative decoding tree search, scientific sequence alignment) are the plausible near-term targets. The paper's microbenchmark methodology — instruction-level → library-level → application-level — is itself a reusable template for characterizing future GPU generations.

## Open threads

- Blackwell (B100/B200) microbenchmark follow-up — re-run the HKUST H100 instruction-level study on Blackwell + FP4 + 5th-gen Tensor Cores. Predates Blackwell release. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- TMA + DSM interaction: do they compose well, or is using both simultaneously bandwidth-bottlenecked? The paper benchmarks each in isolation. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]


## Observations

- SemiAnalysis Tensor Core Evolution（Dylan Patel）提供从 Volta 到 Blackwell 的 TC 架构演进全景：MMA 作用域（quadpair→warp→warpgroup→single-thread）、操作数位置（register→SMEM→TMEM）、精度（FP16→FP8→FP4/NVFP4）、异步化（同步→HGMMA commit/fence→tcgen05 完全异步）；关键量化：TC 吞吐每代翻倍但全局内存延迟未降，SMEM 每代增长以维持 staging buffer；Blackwell TMEM（256KB）功耗效率更高，因操作数 D 被访问 2Kt 次（A/B 各 1 次）。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- NVIDIA 官方 Compute Capability 查询表（2026-01-15 快照）：CC 7.5=Turing，8.0=A100，8.6=A40/RTX 3090，8.9=L40S/RTX 4090，9.0=H100/H200/GH200，10.0=GB200/B200，10.3=GB300/B300，12.0=RTX PRO Blackwell/RTX 5090，12.1=GB10 DGX Spark。 — [[2026-01-15-nvidia-cuda-gpu-compute-capability]]

## Sources drawn on

- (auto-populated by reindex)
