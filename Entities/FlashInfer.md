---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# FlashInfer

Library whose API-logging pattern inspired the SGLang CUDA Debug Crash SKILL's staged verbosity approach.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- In vLLM's GB200 Wide-EP deployment: provides TRTLLM-Gen kernels optimized for GB200 FP4 tensor cores (MoE expert GEMM + O-proj), FP8 GEMM for MLA query projections, and `concat_mla_k` kernel for efficient MLA key concatenation with warp-based processing and vectorized memory access. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- Used as primary kernel backend in vLLM's `gpt-oss-120b` optimization on Blackwell: integrates `trtllm-gen` and `cutlass` MoE backends plus FP8 attention kernels, supporting JIT compilation and auto-tuning; enables systematic `torch.compile`-based kernel fusion rather than hand-coded per-op fusions. — [[2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par]]
- FlashInfer CuteDSL uses an expert-first layout for [[MoE]] (tokens sorted by expert ID into `[num_experts, max_tokens_per_expert, hidden_dim]` tensors) that enables better per-expert batching at large batch sizes but incurs heavy preprocessing (bincount, argsort, scatter) that dominates at batch sizes 1–16; on Blackwell B200 with NVFP4 MoE GPT-OSS-20B, peaks at 1156 TFLOPS (vs SGLang 1168) at BS=4096 but is 1.6–2.4× slower than SGLang at BS=1. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
- FlashInfer RoPE实现比Triton版本快约3× (82us vs 241us per step)，在[[SGLang]] Diffusion处理Qwen-Image-Edit-2511的真实性能对比分析中，切换到FlashInfer rope是三个关键优化之一；可通过Nsight Systems kernel时间线逐一对比来验证此差异。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
