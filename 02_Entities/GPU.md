---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 5
tier: active
---

# GPU

Graphics Processing Unit — NVIDIA/AMD parallel compute accelerator used for ML training and inference

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Comparative TCO vs [[TPU]]: [[GB200]]/GB300 reverses TPUv7's cost advantage in Prefill (35–50% lower cost) via FP4 precision; LMSYS benchmark shows NVL72 GB200 at ~$0.047/M output tokens vs H100 ~$0.14/M; Switch Fabric (NVSwitch/Fat-tree) wins for MoE training (irregular all-to-all traffic), sub-100 chip experiments, and latency-sensitive inference. Decode bottleneck shifts from HBM bandwidth (small batch) to NVLink bandwidth (large batch). — [[2026-01-15-tpu-vs-gpu-全面技术对比-谁拥有-ai-算力最优解]]
- Two interactive GPU memory estimators added to corpus: inference.ai calculator (transformer VRAM formula: model weights + KV cache; training = model+gradients+Adam+kernels) and apxml.com VRAM calculator (Chinese-language, adds MoE misconception clarification, supports inference/fine-tuning modes, GPU count scaling, CPU offload toggle). Both tools list compatible GPU SKUs sorted by memory efficiency. — [[2025-07-24-gpu-calculator]] [[2025-07-24-vram-计算器-nvidia-gpu-与-apple-silicon]]
- General GPU memory formula for training: `Total = Model_Params + Optimizer_State + max(Gradients + Optimizer_Intermediates, Activations)`; peak occurs during forward pass (large batch) or optimizer step (small batch) — the regime changes with batch size, making a single-formula estimate insufficient. For Qwen2.5-1.5B with AdamW: model 6 GB (FP32) + optimizer state 12 GB + max(activations, gradients + intermediates). — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
