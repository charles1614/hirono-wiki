---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://arxiv.org/pdf/2402.13499
tags: [gpu, microbenchmark, paper, low-precision]
---

# [2026-01-15] Benchmarking and Dissecting the NVIDIA Hopper GPU Architecture

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

## Visual observations

**Figure 1 — Hopper architecture overview** (load-bearing context)

![Hopper SM-level architecture diagram showing the L1/Shared Memory hierarchy, the Tensor Memory Accelerator (TMA), distributed shared memory paths, and the L2/HBM tier — the visual context for everything the paper benchmarks](../../raw/raindrop/arxiv.org/2026-01-15-benchmarking-and-dissecting-the-nvidia-h/2026-01-15-benchmarking-and-dissecting-the-nvidia-h-figures/figure-001.png)

The schematic for the SM-level features the paper microbenchmarks — without it, claims like "TMA enables block-level async copy" and "DSM enables SM-to-SM atomics" stay abstract.

**Figure 3 — Where FP8 te.Linear's time actually goes** (load-bearing for the TE-limitation findings)

![Stacked bar chart showing proportion of execution time spent in different operators during FP8 matrix multiplication via te.Linear — exposes that data-format conversion + non-quantized auxiliary ops eat a non-trivial fraction of nominal FP8 speedup](../../raw/raindrop/arxiv.org/2026-01-15-benchmarking-and-dissecting-the-nvidia-h/2026-01-15-benchmarking-and-dissecting-the-nvidia-h-figures/figure-003.png)

Concrete proof of the "FP8 LLM speedups are not the 2× peak rates suggest" claim. The Softmax/GeLU non-quantization + DotProductAttention-uses-FlashAttention finding has visible cost here.

- **Figure 2 — mma vs wgmma instruction semantics** (supporting): defines D = A×B + C vs D = A×B{+D}. Useful for kernel authors writing Tensor-Core code; doesn't change the paper's conclusions.
- **Figure 4 — Throughput comparison for N×N matmul** (supporting): N×N matmul throughput across precisions + hardware. Underlying data behind the precision-comparison section.
- **Figure 5 — TransformerLayer latency vs hidden size** (supporting): te.TransformerLayer FP8 vs FP16 across LLaMA-7B/13B/70B hidden sizes.
- **Figure 6/7 — DPX latency + throughput** (supporting): per-instruction DPX numbers across Ampere/Ada/Hopper.
- **Figure 8 — SM-to-SM network throughput (DSM)** (supporting): DSM bandwidth as a function of ILP.
- **Figure 9 — Histogram application performance with DSM** (supporting): application-level DSM gain over shared-memory baseline.

## What this changes

- **For kernel authors targeting H100**: the paper provides the missing micro-arch data sheet for TMA/DSM/DPX. Anyone writing FlashAttention-style fused kernels or new Triton kernels should reference these numbers when modeling expected gains.
- **For LLM-stack maintainers**: the TE-limitation findings (Softmax/GeLU not FP8, DotProductAttention bypasses FP8 TC) are practical — they explain why FP8 LLM speedups are not the headline 2× over FP16 that tensor-core peak rates would suggest.
- **For Ampere → Hopper migration planning**: instruction-level cross-comparison clarifies which workloads actually benefit from Hopper. Pure FP16 compute: marginal. FP8 + lots of async copy: large.
- **For workload designers**: DPX hardware exists; few LLM workloads use dynamic programming. But adjacent domains (speculative decoding tree search, sequence alignment in scientific computing) could leverage DPX.

## Entities touched

[[H100]], [[A100]], [[Hopper]], [[Ampere]], [[Ada]], [[Volta]], [[Tensor Core]], [[Transformer Engine]], [[TMA]], [[Distributed Shared Memory]], [[DPX]], [[FP8]], [[BF16]], [[TF32]], [[Llama]], [[FlashAttention]], [[HKUST]]

## Topics touched

[[GPU Microarchitecture]], [[Tensor Core Programming]], [[FP8 Computation]], [[GPU Performance Modeling]]

## Raw source

[arxiv.org/abs/2402.13499](https://arxiv.org/abs/2402.13499) — 12-page paper · 525 KB PDF · 8 figures (Marker-extracted, 73,923 text chars) + 9 captioned arxiv-HTML figures. HKUST + HKUST(GZ) + HIT(SZ) authors. Read 2026-05-11 (the Marker re-extraction completed mid-ingest; original ingest was from pdftotext version, this entry was updated to reflect the better raw — substantive claims unchanged).
