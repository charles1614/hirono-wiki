---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 9
tier: active
---

# FP8

8-bit floating-point format; the previous-generation widely-adopted low-precision training format.

## Synthesis

*Regenerated from Observations below.*

## Observations

- (auto-populated as Sources cite this entity)
- FlashMLA's V32 FP8 KVCache format stores each token's KV in 656 bytes (vs. 2304 bytes BF16): 512 FP8_e4m3 NoPE-dimension values + 4 float32 tile-level scale factors + 64 BF16 RoPE values (RoPE kept in BF16 due to quantization sensitivity); crossover technique shares dequantized KV across two CTAs via [[Distributed Shared Memory]], halving dequantization overhead. — [[2026-01-27-deepwiki-flashmla-01-overview]]
- Doc 04 details the dequantization pipeline bottleneck: H800 lacks native FP8→BF16 cast, so dequantization requires FP8→half→float32→BF16 (4 conversion steps, ~50 cycles/token vs. ~34 cycles for MMA). DSM crossover splits this across 2 CTAs to get ~25 cycles each. MODEL1 format is more compact at 512 bytes/token (448 FP8_e4m3 + 8 bytes float8_e8m0fnu scale + 64 bytes BF16 RoPE), enabling 4.5× savings (~156K context on 80 GB). — [[2026-01-30-deepwiki-flashmla-04-memory-management]]
- Tencent [[HPC-Ops]] FP8 Attention decode achieves 1.09×–2.0× improvement over SOTA at large sequence lengths on H20-class inference cards, using Interleave reordering to eliminate thread-level data shuffle and resolve instruction-mismatch issues specific to inference cards. — [[2026-01-27-腾讯混元ai-infra核心技术重磅开源-推理吞吐提升30]]
- Hopper FP8 `wgmma` 实际累加路径为 22-bit 定点格式（13-bit mantissa + 符号 + 指数位），而非真 FP32，导致每 N_c 次累加需溢出到 CUDA core 避免精度受限；[[Blackwell]] 上 FP8 与 FP6 理论吞吐相同，推测二者共用物理电路；CDNA4 FP6 吞吐是 FP8 的 2× 因为 FP6 与 FP4 共用数据路径。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
