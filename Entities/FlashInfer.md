---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# FlashInfer

Library whose API-logging pattern inspired the SGLang CUDA Debug Crash SKILL's staged verbosity approach.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- In vLLM's GB200 Wide-EP deployment: provides TRTLLM-Gen kernels optimized for GB200 FP4 tensor cores (MoE expert GEMM + O-proj), FP8 GEMM for MLA query projections, and `concat_mla_k` kernel for efficient MLA key concatenation with warp-based processing and vectorized memory access. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- Used as primary kernel backend in vLLM's `gpt-oss-120b` optimization on Blackwell: integrates `trtllm-gen` and `cutlass` MoE backends plus FP8 attention kernels, supporting JIT compilation and auto-tuning; enables systematic `torch.compile`-based kernel fusion rather than hand-coded per-op fusions. — [[2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par]]
