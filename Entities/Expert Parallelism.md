---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 5
tier: active
---

# Expert Parallelism

A parallelism strategy for MoE models where different experts are placed on different GPUs, abbreviated EP.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[vLLM]] Wide-EP on [[GB200]] for DeepSeek MoE: reducing EP degree from 4→2 GPUs per prefill instance improved throughput because MLA/MoE compute is already saturated at 64K tokens — halving EP degree halves NCCL all_gather+reduce_scatter overhead; [[NVFP4]] dispatch reduces all-to-all communication volume by 4× vs FP16. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
