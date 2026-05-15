---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# Wide-EP

Wide Expert Parallelism configuration in vLLM for large-scale MoE model serving across many GPUs

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[vLLM]] Wide-EP on [[GB200]] with [[NVFP4]] precision achieved 26.2K prefill TPGS and 10.1K decode TPGS for DeepSeek R1/V3 MoE models (2K in + 2K out), 3–5× over H200 deployment; used 4 prefill instances (2 GPUs each) + 1 decode instance (8 GPUs); key insight: scaling down from 4→2 GPUs per prefill instance improves throughput because compute is already saturated at 64K tokens, and halving EP degree cuts NCCL overhead. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
