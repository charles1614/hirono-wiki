---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# SM Efficiency

GPU metric measuring fraction of streaming multiprocessors active during kernel execution; superior to utilization for performance diagnosis

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- SM Efficiency (SM Activity) is the fraction of active SMs during a time window; a kernel using 1 of 132 SMs on H100 for 10 seconds achieves 100% GPU utilization but only 0.7% SM efficiency; applying fused Transformer kernels (FlashAttention, MLP, LayerNorm, dropout, residual) raised MFU from 20% to 38% and cut training time 4× in a production LLM training case. Available via NVIDIA DCGM by default. — [[2025-11-02-别被-100-骗了-gpu-利用率背后的真相]]
