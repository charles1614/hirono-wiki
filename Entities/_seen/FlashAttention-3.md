---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 2
tier: seen
---

# FlashAttention-3

Third-generation FlashAttention with ping-pong scheduling and intra-warpgroup GEMM-softmax pipelining for Hopper.

## Observations

- FP8 wgmma accumulator (C/S matrix after gemm0) has non-contiguous thread ownership (T0 owns d0,d1,d4,d5) while FP8 operand A for gemm1 requires contiguous elements (T0 owns a0–a3), preventing direct post-softmax reuse; CUTLASS 3.5+ `permutationLayout` in `make_tiled_mma` fixes the layout; FP16/BF16 accumulator and operand A are natively compatible. — [[2025-05-26-flashattention-v3解读之fp8-fp16-bf16关键细节实现-]]
- V transpose on Hopper uses LDSM_T source → STSM_N destination in shared memory (no register hop); prehopper used LDSM_T register-side transpose. Inter-WG overlap (barrier pingpong between two consumer WGs) and intra-WG overlap (gemm1 at iter X with softmax at iter X+1 via wgmma async) apply to both FP8 and FP16/BF16. Blackwell `tcgen05.mma` natively handles block scaling as a hardware instruction. — [[2025-05-26-flashattention-v3解读之fp8-fp16-bf16关键细节实现-]]
