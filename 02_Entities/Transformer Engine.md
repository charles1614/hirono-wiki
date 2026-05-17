---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 3
tier: active
---

# Transformer Engine

NVIDIA's library for FP8 LLM training on Hopper+; wraps Linear/MLP layers to use FP8 Tensor Cores; ~2x speedup target.

## Synthesis


Transformer Engine is NVIDIA's library wrapping FP8 Tensor Core math for Hopper-generation GPUs, designed to accelerate LLM training and inference. Its FP8 coverage is partial, not end-to-end: te.Linear is the only fully quantized operator, while Softmax and GeLU remain in BF16, incurring format-conversion overhead, and te.DotProductAttention routes through FlashAttention rather than FP8 Tensor Cores, so attention gains nothing from FP8. Decode-only causal models such as LLaMA and GPT require manual replacement of nn.Linear and RMSNorm with TE equivalents before the library engages at all. On the communication-overlap front, TE's stream/event-based approach suffers SM underutilization at small batch sizes, making it slower than a non-overlap PyTorch baseline in that regime — the structural weakness that Flux's kernel-fusion design directly targets, achieving 1.38x over TE in training and 2.06x/2.10x over TE on prefill/decoding. The headline 2x FP8-over-FP16 speedup is therefore achievable only on linear-dominated workloads with sufficiently large batch sizes.


## Observations

- The communication-overlap baseline Flux benchmarks against. Flux delivers **1.38× over TransformerEngine on 128-GPU training**, **2.06× over TE on prefill**, **2.10× over TE on decoding** (8-GPU clusters). TE's overlap path is *negative* (slower than non-overlap PyTorch) at small `m` due to SM underutilization — the structural problem Flux's kernel-fusion approach addresses. — [[2025-10-09-flux-fast-software-based-communication-o]]
- NVFP4 inference outperforms training (50 vs 35 PFLOPS on Rubin) not due to hardware asymmetry but recipe differences: inference uses calibrated static tensor-wide scaling factors enabling more kernel fusion; training must compute scaling factors dynamically, limiting fusions; Random Hadamard Transformations in the backward pass do not occur during inference. A NVIDIA member confirms the 3rd Gen Transformer Engine's "adaptive compression" for NVFP4 cannot be commented on beyond official disclosures. — [[2026-01-27-why-nvfp4-inference-50-pflops-outperform]]
- HKUST microbench exposes Transformer Engine's FP8-path limits: `te.Linear` is the only fully FP8-quantized operator; `te.LayerNormMLP` uses FP8 for intermediate transfer; **Softmax and GeLU are NOT quantized to FP8**, causing data-format-conversion overhead; **`te.DotProductAttention` uses flash-attention, not FP8 Tensor Cores**, so attention bypasses FP8. Decode-only causal LMs (LLaMA, GPT) need manual `nn.Linear` + `RMSNorm` replacement to engage TE at all. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
