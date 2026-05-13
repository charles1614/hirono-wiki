---
created: 2026-05-11
updated: 2026-05-13
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 5
tier: active
---

# vLLM

Open-source LLM inference engine; PagedAttention; continuous batching; the dominant production inference system today.

## Synthesis


vLLM is the dominant open-source LLM inference engine, built on PagedAttention and continuous batching, and serves as the production baseline the broader inference ecosystem benchmarks against. Its v1 metrics story matured in late 2025 when PR #26811 landed connector-agnostic KV-cache observability via a KVConnectorStats abstraction, exposing NIXL transfer metrics to Prometheus so that prefill-decode-disaggregated deployments gain first-class dashboard coverage and future backends like Mooncake inherit the same metric shape for free. Kernel-fusion research from ByteDance's Flux project quantifies headroom above vanilla vLLM: 1.66x prefill and 1.30x decoding speedups on 8-GPU tensor-parallel clusters by fusing communication and compute tiles into a single CUTLASS kernel, eliminating the SM-underutilization penalty of prior stream-scheduled overlap methods. A 2025 LLM inference systems survey (Pan and Li, arXiv:2506.21901) situates vLLM alongside SGLang, Mooncake, and DeepFlow as one of the anchor systems for the field, framing the space through a database-systems lens of load prediction, adaptive mechanisms, and cost reduction. The pedagogical companion Nano-vLLM (~1,200 lines of Python) reproduces the core engine — paged attention, prefix caching, tensor parallelism, Torch compile, CUDA graphs — and matches or slightly exceeds vLLM throughput on a laptop-class benchmark (1,434 vs 1,361 tok/s on Qwen3-0.6B), making the internals accessible without requiring readers to navigate the full production codebase.


## Observations

- PR #26811 (merged Oct 29 2025 by `simon-mo`) exposes **KVConnector metrics to Prometheus**: NickLucche shipped NIXL-specific first, `markmc` generalized into **KVConnectorStats** as a per-connector abstraction so future KV-transfer backends (Mooncake, custom RDMA) inherit the dashboard story. Histogram buckets: `2KB...8GB` log-scale × 4. Branch `nixl-prometheus` → `main`. — [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]
- Reference baseline for Flux's inference comparison: **1.66× prefill and 1.30× decoding speedups** over vanilla vLLM on 8-GPU TP clusters (and 2.06× / 2.10× over TransformerEngine specifically). — [[2025-10-09-flux-fast-software-based-communication-o]]
- **Nano-vLLM** (~1,200 LoC Python) re-implements vLLM's core (paged attention, prefix caching, tensor parallelism, Torch compile, CUDA graphs) for pedagogy — matches or slightly beats vLLM throughput on a laptop-class benchmark (Qwen3-0.6B on RTX 4070 Laptop 8GB, 256 sequences: 1434 vs 1361 tok/s). API mirrors vLLM closely (`LLM`, `SamplingParams`, `llm.generate`). — [[2025-12-14-geeeekexplorer-nano-vllm-nano-vllm]]
- Anchor case in Pan & Li's "A Survey of LLM Inference Systems" (arXiv:2506.21901, June 2025, cs.DB framing) alongside SGLang, Mooncake, and DeepFlow. — [[2026-05-08-a-survey-of-llm-inference-systems]]
