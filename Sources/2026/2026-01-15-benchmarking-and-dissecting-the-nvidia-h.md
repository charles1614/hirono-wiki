---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2402.13499
tags: [hopper, h100, ampere, ada, gpu, microbenchmark, tensor-core, fp8, dpx, tma, dsm, hkust]
---

# [2026-01-15] Benchmarking and Dissecting the NVIDIA Hopper Architecture

## TL;DR

HKUST + HIT paper (Wenlin Luo et al., arXiv:2402.13499, Feb 2024) — **instruction-level microbenchmark study of the Hopper (H100) architecture**, cross-compared against Ampere (A100) and Ada (RTX 4090/L40). The paper fills a documentation gap: NVIDIA publishes top-line specs but the micro-architectural detail needed to optimize kernels is undisclosed. **Three novel features benchmarked for the first time**: **Distributed Shared Memory (DSM)** for direct SM-to-SM communication, **Tensor Memory Accelerator (TMA)** for asynchronous block-level copies, and **DPX instructions** for dynamic-programming acceleration. Also benchmarks **FP8 Tensor Cores + Transformer Engine** at three levels (tensor-core instruction, te.Linear/te.TransformerLayer library, LLaMA generation application). The headline takeaway: Hopper's gains over Ampere come *mostly* from FP8 + TMA + DSM rather than raw clock/IPC; programmer awareness is the load-bearing path to extracting those gains.

## Key claims

- **Three Hopper-novel features benchmarked here for the first time** (per the authors):
  1. **Tensor Memory Accelerator (TMA)** — asynchronous block-level memcopy between global and shared memory. Builds on Ampere's `cuda::memcpy_async`. Enables overlap of compute with data movement without thread occupation.
  2. **Distributed Shared Memory (DSM)** — direct SM-to-SM communications (loads/stores/atomics) across multiple SM shared memory blocks in a thread block cluster. Reduces L2/HBM traffic for cooperating SMs.
  3. **DPX instructions** — hardware-accelerated dynamic programming primitives (min/max comparators over previously computed solutions). Hopper-only HW support (CUDA 12+ API on older GPUs is emulated).
- **Tensor Core precision support across generations**:
  - **Volta** (V100): FP16, FP32.
  - **Ampere** (A100): + INT8, INT4, FP64, BF16, TF32, sparsity.
  - **Hopper** (H100): + **FP8** (key LLM-training/inference acceleration).
  - Each generation adds precisions; Hopper's FP8 is the qualitative jump for LLM workloads.
- **Three-level FP8 / Transformer Engine benchmark methodology**:
  1. **Tensor-core instruction level**: latency + throughput of the raw MMA primitives at each precision.
  2. **Library level**: `te.Linear`, `te.LayerNormMLP`, `te.TransformerLayer` from Transformer Engine.
  3. **Application level**: real LLaMA generation via ShareGPT dataset, throughput = `(input_len + output_len) / time`.
- **Transformer Engine limitations exposed**:
  - **te.Linear is the only fully FP8-quantized operator path.** te.LayerNormMLP fuses norm+MLP and uses FP8 for the intermediate transfer.
  - **Softmax and GeLU are NOT quantized to FP8** in current TE → causes data-format-conversion overhead.
  - **DotProductAttention uses flash-attention**, not FP8 Tensor Cores. So attention doesn't actually benefit from FP8 in TE.
  - Decode-only causal LMs (LLaMA, GPT) need manual replacement of `nn.Linear` + `RMSNorm` with TE equivalents — TE doesn't out-of-the-box accelerate them.
- **Hidden-size sensitivity**: when comparing FP8 vs FP16 on `te.TransformerLayer`, results depend on the linear layer's hidden state. Tested at LLaMA 7B (hidden=4096), 13B (5120), 70B (8192).
- **TMA microbenchmark**: SyncShare (synchronous copy) vs AsyncPipe (TMA with two-stage doubled-buffer pipeline). Matrix dimensions 2048, block sizes 8×8 to 32×32. Shows where async overlap pays off in compute throughput.
- **DPX**: instruction latency + per-SM throughput measured; block-count vs throughput curve identifies where DPX HW lives.
- **DSM**: SM-to-SM bandwidth + atomics latency characterized. Useful for cooperative-thread-array (CTA) clustering work.

## What this changes

- **For kernel authors targeting H100**: the paper provides the missing micro-arch data sheet for TMA/DSM/DPX. Anyone writing FlashAttention-style fused kernels or new Triton kernels should reference these numbers when modeling expected gains.
- **For LLM-stack maintainers**: the TE-limitation findings (Softmax/GeLU not FP8, DotProductAttention bypasses FP8 TC) are practical — they explain why FP8 LLM speedups are not the headline 2× over FP16 that tensor-core peak rates would suggest.
- **For Ampere → Hopper migration planning**: instruction-level cross-comparison clarifies which workloads actually benefit from Hopper. Pure FP16 compute: marginal. FP8 + lots of async copy: large.
- **For workload designers**: DPX hardware exists; few LLM workloads use dynamic programming. But adjacent domains (speculative decoding tree search, sequence alignment in scientific computing) could leverage DPX.
- **Pairs with**: [[2025-10-09-eagle-3-scalingupinference-acceleration-]] (uses TC FP8 in real prod stack), [[2025-10-09-flux-fast-software-based-communication-o]] (CUTLASS-based comm-overlap also targets H100 H800), [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]] (CUDA 13.1 Tile programming model attempts to abstract away exactly the kind of arch-specific tuning this paper documents).

## Entities touched

[[H100]], [[A100]], [[Hopper]], [[Ampere]], [[Ada]], [[Volta]], [[Tensor Core]], [[Transformer Engine]], [[TMA]], [[DSM]], [[DPX]], [[FP8]], [[BF16]], [[TF32]], [[LLaMA]], [[FlashAttention]], [[HKUST]]

## Topics touched

[[GPU Microarchitecture]], [[Tensor Core Programming]], [[FP8 Computation]], [[GPU Performance Modeling]]

## Open questions

- The paper is from Feb 2024 (v1). FP8 LLM ecosystem has matured significantly since (TransformerEngine v1.x → v2.x, vLLM FP8, etc.) — do the TE limitations (Softmax/GeLU/Attention) still hold in 2025/2026 versions?
- **Blackwell (B100/B200)** isn't covered (paper predates Blackwell release). The natural follow-up: re-run all microbenchmarks on Blackwell + FP4 + 5th-gen Tensor Cores.
- DPX adoption — has anyone published a real LLM-adjacent use of DPX? Speculative-decoding tree pruning is a natural fit but not yet seen in OSS implementations.
- The application-level LLaMA benchmark uses input=128 + output=128 + batch=8. **Realistic workloads have much longer contexts.** How do the relative FP8 vs FP16 gains scale with context length?
- TMA + DSM interaction: do they compose well, or is using both simultaneously bandwidth-bottlenecked? Worth a follow-up.

## Raw source

[arxiv.org/abs/2402.13499](https://arxiv.org/abs/2402.13499) — 12-page paper · 525 KB PDF · 9 captioned arxiv-HTML figures (no Marker extraction this round; the pdftotext path produced 1 figure ref in body). HKUST + HKUST(GZ) + HIT(SZ) authors. Read 2026-05-11.
