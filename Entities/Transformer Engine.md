---
created: 2026-05-11
updated: 2026-05-11
type: entity
refs: 2
tier: active
---

# Transformer Engine

NVIDIA's library for FP8 LLM training on Hopper+; wraps Linear/MLP layers to use FP8 Tensor Cores; ~2x speedup target.

## Synthesis

NVIDIA's library wrapping FP8 Tensor Core math for Hopper+ LLM training. **Two practical findings shape its real-world deployment:** (1) Flux's evaluation shows TransformerEngine's communication-overlap path can be *slower* than non-overlap PyTorch at small `m` due to SM-underutilization (the failure mode kernel-fusion comm overlap addresses); (2) HKUST's microbench reveals that TE's FP8 path is not end-to-end — `te.Linear` is fully quantized but Softmax/GeLU stay BF16 (data-format-conversion overhead), and `te.DotProductAttention` bypasses FP8 TC entirely for FlashAttention. The headline 2× FP8-vs-FP16 speedup is achievable only on linear-dominated workloads.

## Observations

- The communication-overlap baseline Flux benchmarks against. Flux delivers **1.38× over TransformerEngine on 128-GPU training**, **2.06× over TE on prefill**, **2.10× over TE on decoding** (8-GPU clusters). TE's overlap path is *negative* (slower than non-overlap PyTorch) at small `m` due to SM underutilization — the structural problem Flux's kernel-fusion approach addresses. — [[2025-10-09-flux-fast-software-based-communication-o]]
- HKUST microbench exposes Transformer Engine's FP8-path limits: `te.Linear` is the only fully FP8-quantized operator; `te.LayerNormMLP` uses FP8 for intermediate transfer; **Softmax and GeLU are NOT quantized to FP8**, causing data-format-conversion overhead; **`te.DotProductAttention` uses flash-attention, not FP8 Tensor Cores**, so attention bypasses FP8. Decode-only causal LMs (LLaMA, GPT) need manual `nn.Linear` + `RMSNorm` replacement to engage TE at all. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
