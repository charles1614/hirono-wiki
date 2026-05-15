---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Expert Parallelism

A parallelism strategy for MoE models where different experts are placed on different GPUs, abbreviated EP.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[vLLM]] Wide-EP on [[GB200]] for DeepSeek MoE: reducing EP degree from 4→2 GPUs per prefill instance improved throughput because MLA/MoE compute is already saturated at 64K tokens — halving EP degree halves NCCL all_gather+reduce_scatter overhead; [[NVFP4]] dispatch reduces all-to-all communication volume by 4× vs FP16. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- [[SGLang]]'s DeepEP implementation: all-to-all dispatch (token routing to expert-owning ranks) → local GEMM → all-to-all combine; supports FP8 communication to reduce bandwidth pressure; two modes — Normal (prefill) and Low-Latency (decode) — requiring PD disaggregation to coexist; the 1.25–1.84× single-card kernel gains stack multiplicatively with multi-node EP gains. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
