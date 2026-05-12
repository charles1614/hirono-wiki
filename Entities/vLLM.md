---
created: 2026-05-11
updated: 2026-05-11
synthesis_updated_at: 2026-05-12
type: entity
refs: 4
tier: active
---

# vLLM

Open-source LLM inference engine; PagedAttention; continuous batching; the dominant production inference system today.

## Synthesis

Dominant open-source LLM inference engine — PagedAttention + continuous batching, the production target the rest of the stack benchmarks against. **v1 metrics + KV-connector path** are the late-2025 observability story (PR #26811 exposed NIXL transfer metrics via the generalized KVConnectorStats abstraction to Prometheus; the abstraction is intentionally connector-agnostic so future backends like Mooncake inherit dashboards). Flux measures **1.66× prefill / 1.30× decoding speedups** over vanilla vLLM via kernel-fusion comm-overlap. Pedagogical companion **Nano-vLLM** (~1,200 LoC) reproduces the core (paged attention, prefix caching, TP, Torch compile, CUDA graphs) and matches/slightly-beats throughput on a Qwen3-0.6B laptop-class benchmark.

## Observations

- PR #26811 (merged Oct 29 2025 by `simon-mo`) exposes **KVConnector metrics to Prometheus**: NickLucche shipped NIXL-specific first, `markmc` generalized into **KVConnectorStats** as a per-connector abstraction so future KV-transfer backends (Mooncake, custom RDMA) inherit the dashboard story. Histogram buckets: `2KB...8GB` log-scale × 4. Branch `nixl-prometheus` → `main`. — [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Reference baseline for Flux's inference comparison: **1.66× prefill and 1.30× decoding speedups** over vanilla vLLM on 8-GPU TP clusters (and 2.06× / 2.10× over TransformerEngine specifically). — [[2025-10-09-flux-fast-software-based-communication-o]]
- **Nano-vLLM** (~1,200 LoC Python) re-implements vLLM's core (paged attention, prefix caching, tensor parallelism, Torch compile, CUDA graphs) for pedagogy — matches or slightly beats vLLM throughput on a laptop-class benchmark (Qwen3-0.6B on RTX 4070 Laptop 8GB, 256 sequences: 1434 vs 1361 tok/s). API mirrors vLLM closely (`LLM`, `SamplingParams`, `llm.generate`). — [[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]]
- Anchor case in Pan & Li's "A Survey of LLM Inference Systems" (arXiv:2506.21901, June 2025, cs.DB framing) alongside SGLang, Mooncake, and DeepFlow. — [[2026-05-08-a-survey-of-llm-inference-systems]]
