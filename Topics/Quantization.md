---
created: 2026-05-12
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 9
---

# Quantization

## What

Reducing numeric precision of model weights / activations for inference / training speedup with minimal quality loss.

## Current understanding

**Quantization** reduces the numeric precision of model weights and/or activations — typically from 32-bit or 16-bit floats down to 8-bit integers (INT8), 4-bit integers (INT4), or lower — enabling faster inference, smaller memory footprints, and reduced bandwidth pressure with acceptable quality degradation.

The two dominant paradigms are **post-training quantization (PTQ)** and **quantization-aware training (QAT)**. PTQ applies quantization after a model is fully trained, requiring only a small calibration dataset; it is fast and cheap but can degrade accuracy, especially at aggressively low bit-widths. QAT simulates quantization noise during fine-tuning, allowing the model to adapt its weights to the lower-precision regime; it recovers more accuracy but requires a training loop and labeled data.

**Weight-only quantization** (e.g. GPTQ, AWQ, bitsandbytes NF4) quantizes weights to 4-bit while keeping activations in float16 during compute. This is the dominant approach for LLM deployment: weights dominate memory at inference time, so compressing them yields the primary gains without requiring activation quantization, which is harder to get right. **Weight-and-activation quantization** (e.g. SmoothQuant, LLM.int8()) quantizes both, enabling true INT8 matrix-multiply on hardware that supports it (A100 Tensor Cores, H100 FP8 units), but is more sensitive to outlier activations.

A key engineering challenge is **outlier activations**: large-magnitude channels that appear systematically in transformer hidden states and cause large quantization error if naïvely clipped. Techniques like SmoothQuant migrate the quantization difficulty from activations to weights via a per-channel scaling factor; AWQ identifies salient weight channels and protects them; GPTQ uses a second-order (Hessian-based) error-minimization procedure to compensate for per-weight quantization error.

**Granularity** — how finely quantization parameters (scale, zero-point) are applied — is a core knob. Per-tensor quantization uses one scale for an entire weight matrix (fast, coarse). Per-channel applies a scale per output channel (much better accuracy for weights). Per-group (e.g. group-size 128) applies a scale per small block of weights, offering a quality/overhead tradeoff that dominates in 4-bit LLM quantization. The lower the bit-width, the finer the granularity needed to preserve accuracy.

Emerging hardware support is shifting the design space: H100/H200 introduce **FP8** (E4M3 / E5M2) as a first-class training and inference format, enabling higher throughput than INT8 while retaining more dynamic range than INT4. FP8 training is now the default mixed-precision regime for frontier-scale runs, while INT4/NF4 weight compression remains the standard for consumer-device inference.

The quality cost of quantization is non-uniform across models and tasks. Larger models tolerate aggressive quantization better (a 70B model at 4-bit often outperforms a 7B model at 8-bit on the same hardware budget). Code generation and math benchmarks are more sensitive to precision loss than open-ended generation. Perplexity on held-out text is a coarse proxy; downstream task accuracy on reasoning benchmarks is the load-bearing eval.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_
