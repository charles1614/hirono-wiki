---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://www.glennklockwood.com/garden/tensor-cores
tags: [gpu-hardware, numerical-precision, reference]
---

# [2025-11-06] Tensor cores and Matrix cores

## TL;DR

Concise reference page by Glenn Klockwood comparing NVIDIA Tensor Cores and AMD Matrix Cores across generations, documenting the MMA matrix sizes, supported dtypes, FLOPS/clock/core, and SM/CU counts from V100 through H100 (NVIDIA) and MI250X/MI300X (AMD).

## Key claims

- Both implement D = A×B + C in a single clock cycle; NVIDIA calls them Tensor Cores, AMD calls them Matrix Cores; both vendors describe capability as m×n×k operations.
- NVIDIA V100 (1st gen): 4×4×4 FP16 MMA, 128 FP16 FLOPS/clock/core, 8 cores/SM, 80 SMs → peak throughput calculable.
- NVIDIA A100 (3rd gen): 8×4×8 FP16 MMA (512 FP16 FLOPS/clock), 2×2×4 FP64 (32 FP64 FLOPS/clock), 4 cores/SM, 108 SMs; adds BF16, TF32, INT8 support.
- NVIDIA H100 (4th gen): 8×4×16 FP16 MMA (1024 FP16 FLOPS/clock), 4×2×4 FP64 (64 FP64 FLOPS/clock), 4 cores/SM, 132 SMs; adds FP8 (E4M3, E5M2) support.
- AMD MI250X (CDNA2): 4 Matrix Cores/CU, 220 CUs/GPU (110 per GCD).
- AMD MI300X (CDNA3): 4 Matrix Cores/CU, 304 CUs/GPU.
- Total FLOPS per GEMM formula: m×n×2k (e.g., 4×4×4 = 128 FLOPS per MMA op, combining multiply-accumulate counting).
- NVIDIA's SDK exposes only logical matrix sizes; CUDA runtime maps to hardware MMA dimensions; AMD SDK similarly abstracts underlying hardware.

## Visual observations

![](../../raw/raindrop/www.glennklockwood.com/2025-11-06-tensor-cores-and-matrix-cores/default-img-001.png)

*Shows NVIDIA Tensor Core geometry diagrams across generations.*

## Entities touched

[[Tensor Core]]

## Topics touched

[[GPU Microarchitecture]], [[Tensor Core Programming]], [[AI Accelerators]]

## Raw source

[glennklockwood.com/garden/tensor-cores](https://www.glennklockwood.com/garden/tensor-cores) — Glenn Klockwood personal digital garden reference page, no date given. Read 2026-05-15.
