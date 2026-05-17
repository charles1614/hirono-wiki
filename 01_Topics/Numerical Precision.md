---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 3
---

# Numerical Precision

## What

Choosing data types for training and inference — BF16, FP16, FP8, FP4 — and the stability tradeoffs each makes.

## Current understanding

Numerical precision in deep learning refers to the bit-width and floating-point format used to represent weights, activations, and gradients during training and inference. The central tradeoff is between **representational range and resolution** (higher precision) versus **memory footprint, bandwidth, and compute throughput** (lower precision).

**BF16 (Brain Float 16)** has become the dominant training format for large models. It retains the same 8-bit exponent as FP32, giving identical dynamic range, while halving the mantissa to 7 bits. This makes overflow and underflow rare without loss scaling, which is why frameworks like PyTorch default to BF16 for Ampere+ GPUs and TPUs. FP16 has a smaller exponent (5 bits), requiring careful loss scaling to avoid gradient underflow — it dominated the previous generation (V100-era) but has largely been superseded for training on newer hardware.

**Mixed-precision training** uses FP16 or BF16 for forward and backward passes while keeping a FP32 "master copy" of weights for the optimizer update step. The FP32 copy absorbs gradient noise that BF16/FP16 would otherwise round away, preventing weight stagnation. This pattern (popularized by NVIDIA Apex and now native in `torch.amp`) halves memory for activations and weights while keeping optimizer states at full precision.

**FP8** (introduced with NVIDIA H100 / Hopper) pushes precision lower still, enabling roughly 2× the throughput of BF16 matmuls on compatible hardware. Two variants exist: E4M3 (4-bit exponent, 3-bit mantissa — higher resolution, smaller range, suited for weights and activations) and E5M2 (5-bit exponent, 2-bit mantissa — wider range, suited for gradients). FP8 training requires per-tensor scaling factors and careful amax tracking to stay numerically stable; frameworks like Transformer Engine and JAX handle this via delayed scaling.

**FP4 and INT4** represent the current frontier for inference quantization. Post-training quantization (PTQ) at INT4 can deliver 4× memory reduction over FP16 with acceptable quality loss on large models if applied with groupwise scaling (e.g., GPTQ, AWQ). FP4 is emerging as a hardware-native format on next-generation accelerators (Blackwell / GB200). The key instability risk at 4-bit is **outlier activations**: a small number of channels carry extremely large values that dominate the quantization grid, causing catastrophic rounding for normal-range values. Techniques like SmoothQuant migrate outlier magnitude from activations into weights before quantization to mitigate this.

**The stability hierarchy** across formats is roughly: FP32 > BF16 ≈ FP16-with-loss-scaling > FP8 (with per-tensor scaling) > INT8 > FP4/INT4. Each step down requires progressively more careful calibration, scaling, or mixed-precision fallback for sensitive layers (embedding tables, layer norms, logit heads). There is no universally "safe" lower-precision format — the tolerable floor depends on model size (larger models are more quantization-robust), task sensitivity, and whether the quantization is applied to weights only, activations only, or both (W4A8 vs W4A4 are distinct regimes).

## Open threads

## Observations

- Hopper FP8 TC 累加路径实为 22-bit 定点（13-bit mantissa + 符号 + 指数），每 N_c 次需回到 CUDA core 以避免精度受限；INT4 自 Hopper 起废弃、Blackwell Ultra INT8 吞吐下降，均源于整数精度数据类型普及（4 年后）滞后于硬件设计周期；NVFP4 4:8 pair-wise 结构化稀疏因 sub-byte 特性约束更严格。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
