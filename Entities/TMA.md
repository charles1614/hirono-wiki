---
created: 2026-05-11
updated: 2026-05-16
type: entity
refs: 6
tier: active
---

# TMA

Tensor Memory Accelerator; Hopper+ instruction for async global↔shared memory copies; used heavily in FlashAttention-3 + FlashMLA.

## Synthesis

*Regenerated from Observations below.*

## Observations

- (auto-populated as Sources cite this entity)
- [[FlashMLA]] uses TMA for fine-grained K-block pipelining: each 64×576 K-block is issued as 9 TMA copies (each 64×64) with `EVICT_FIRST` cache hints; GEMM operations begin as soon as each 64×64 tile arrives in shared memory. This TMA-GEMM interleave hides memory latency without additional thread synchronization overhead. — [[2026-01-30-deepwiki-flashmla-04-memory-management]]
- TMA（Tensor Memory Accelerator）是 Hopper 每个 SM 上的专用硬件单元，加速全局内存→共享内存的 bulk 异步拷贝（`cp.async.bulk`）；单线程即可发起，支持 multicast（一次 HBM 加载写入多 SM SMEM），减少 L2 缓存流量；但对小请求（如 LLM KV cache 小块加载）延迟高于 `cp.async`，需每块 ≥16 bytes 才能摊销开销。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- FlashAttention-V3's producer warpgroup is entirely dedicated to TMA loads (gmem→smem), executing concurrently with the consumer warpgroup's WGMMA+softmax via async transaction barriers — illustrating the warp-specialized pattern that Hopper's independent register allocation per warpgroup makes practical. — [[2025-05-26-flashattention-v3解读之hopper-gpu版flashatte]]
