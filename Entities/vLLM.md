---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 31
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
- v1 distributed architecture supports **six parallelism axes**: TP, PP, EP, DP, [[Prefill Context Parallelism]] (PCP, MoE-prefill), [[Decode Context Parallelism]] (DCP, long-context decode). PCP adds workers (`world_size *= pcp_size`); DCP subdivides the TP group. PCP attention-layer support is infrastructure-ready but all backends currently set `supports_pcp = False` (source commit 4061dcf4c). — [[2026-02-08-deepwiki-vllm-10-distributed-prefill-con]]
- Achieved 26.2K prefill TPGS and 10.1K decode TPGS on [[GB200]] for DeepSeek MoE workloads (2K in + 2K out) via [[Wide-EP]] with four levers: [[NVFP4]] GEMM + dispatch (4× comm reduction), kernel fusion (RoPE+Quant+Q Write, RoPE+Quant, `concat_mla_k`), weight offloading v2 with async prefetch via [[NVLink]]-C2C, and prefill scale-down from 4→2 GPUs per instance to cut NCCL overhead. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- Optimized `gpt-oss-120b` (OpenAI native MXFP4 MoE) on [[Blackwell]]: 38% higher max throughput and 13% lower min latency vs InferenceMAX baseline by integrating [[FlashInfer]] as primary kernel backend (`trtllm-gen` + `cutlass` MoE), using `torch.compile`-driven AllReduce+RMSNorm fusion, and deploying async scheduling + Stream Interval to eliminate host CPU overhead (57% improvement at 1024 concurrency). — [[2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par]]
- At PyTorch Conference 2025, at least 53 of 117 sessions (~45%) mentioned vLLM, spanning dedicated talks (#3 vLLM & DeepSpeed keynote, #44 "Easy, Fast, and Cheap LLM Serving"), cross-accelerator deployment (AMD/Triton #69, Amazon NxD #81), post-training co-location with TRL (#60), and disaggregated inference (#78). Signals vLLM as the de facto inference backend across the [[PyTorch]] ecosystem. — [[2025-12-14-vllm-project-vllm-in-pytorch-conference-]]
- AngelSlim v2（腾讯混元）训练的Eagle3草稿模型训练完成后直接兼容vLLM部署（以及SGLang），vLLM被列为AngelSlim的优先部署目标框架之一；测试设置num_speculative_tokens=2 or 4时接收长度1.8-3.5，加速1.4-1.9×。 — [[2026-01-13-腾讯angelslim重磅升级-面向全模态的大模型压缩算法工具包-推理速度飙升-]]
- vLLM's [[NVFP4]] MoE forward launches **7 separate CUDA kernels** (shuffle → quant → GEMM1 → SiLU → quant → GEMM2 → shuffle), using a generic [[CUTLASS]] 3.x schedule without Blackwell-specific TMA alignment padding; at batch size 1–4, kernel launch overhead alone accounts for 10–20% of latency. Benchmarked at 1026 TFLOPS peak on [[Blackwell]] B200 for GPT-OSS-20B (32 experts, top-4, NVFP4), 142 TFLOPS below [[SGLang]]. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
