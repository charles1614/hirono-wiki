---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 27
---

# KV Cache Management

## What

The accumulated key/value tensors that attention reuses across decoding steps — and the systems-level problem of where they live, how they're sharded, how they move between pools (in disaggregated serving), and how their bandwidth + capacity bound serving throughput. KV management is the load-bearing operator concern that distinguishes "inference is slow" from "inference scales": **per-request KV is small, but at high concurrency it's the binding constraint on both memory and inter-stage bandwidth**.

## Current understanding

KV cache management sits at the intersection of memory architecture and serving throughput: the accumulated key/value tensors from attention are small per-request but become the binding constraint on both GPU memory capacity and inter-stage bandwidth at high concurrency. The goal of the field is to make that constraint tractable — through paging, eviction, offloading, quantization, and cache persistence — while keeping per-token latency bounded.

**The "KV transfer is a bandwidth bottleneck" hypothesis has been closed.** [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] (NVIDIA, arXiv:2506.05508) provides the analytical proof: egress bandwidth from the prefill side *drops* as input sequence length (ISL) grows, because first-token latency (FTL) scales superlinearly via attention's quadratic cost while KV size scales only linearly. Ingress bandwidth on the decode side is inversely proportional to output sequence length (OSL). Across realistic SLAs and ISL/OSL ranges, provisioned datacenter bandwidth is sufficient. The implication: practitioners building disaggregated serving stacks should stop treating bandwidth as the primary design constraint for KV transfer.

**Parallelism choice interacts non-trivially with KV footprint.** When TP rank count exceeds `N_kvheads`, KV cache is replicated across TP ranks rather than sharded — so a TP=8 deployment on a model with only 8 KV heads carries full KV replication, while the same model with 64 KV heads gets 8-way sharding. This means KV memory footprint and per-GPU transfer bandwidth are jointly determined by the parallelism strategy, not just by model size or sequence length. It is a common miscalculation to reason about KV cost without fixing the TP/KV-head ratio.

**Observability for the KV-transfer data plane is now first-class in vLLM.** [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] (vLLM PR #26811, merged Oct 29 2025) exposes NIXL transfer durations, sizes, and counts to Prometheus via a new `KVConnectorStats` abstraction. Critically, the abstraction is connector-agnostic: future KV-transfer backends (Mooncake, custom RDMA) inherit the same metric surface without additional instrumentation work. Before this PR, operators running PD-disaggregated vLLM deployments had no visibility into the KV-transfer data plane; long-tail transfer latency was invisible to SLO tracking. The histogram-bucket recipe (`2KB → 8GB` log-scale × 4) is borrowable for any transfer or weight-loading histogram spanning wide byte ranges.

**The survey framing situates KV management within the broader inference design space.** [[2026-05-08-a-survey-of-llm-inference-systems]] (Pan + Li, arXiv:2506.21901) treats memory management — **paged memory, eviction + offloading, quantization, cache persistence** — as one of four major axes of LLM inference system design. The filing under `cs.DB` rather than `cs.AI` is deliberate: the authors position KV management as the analogue of buffer-pool management in database systems, with eviction policies mapping to LRU/MRU/clock and cache persistence mapping to warm-restart from disk. This framing is productive: decades of DB buffer-management literature become directly applicable, and techniques like cost-based eviction or multi-version concurrency have clear inference analogues.

**The remaining KV-management work is operational, not architectural.** Bandwidth is not the constraint; the open problems are (1) dynamic rate matching between prefill and decode pools — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] shows a fixed Ctx:Gen GPU ratio is Pareto-suboptimal and that the optimal ratio varies with model, traffic shape, and latency target; (2) observability so operators can correlate KV-transfer behavior against request-level SLOs (being addressed by [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]]); and (3) eviction/offloading policy research, which the survey identifies as one of the active open challenges in the memory-management axis but does not detail (full survey PDF not in corpus).

## Open threads

## Observations

- [[FlashMLA]] paged KVCache layout: block table maps logical sequence positions to physical 64-token blocks; index encoding `block_idx × page_block_size + offset_in_block` enables direct sparse-attention KV access without table lookup. FP8 V32 format achieves 3.5× KVCache savings (656 bytes vs 2304 bytes BF16/token), enabling 122K context in 80 GB vs 35K for BF16. FP8 MODEL1 format achieves 4.5× savings (512 bytes/token, ~156K context). — [[2026-01-30-deepwiki-flashmla-04-memory-management]]

- Alibaba Cloud Tair + SGLang HiCache (Dec 2025) demonstrates hierarchical KVCache offloading to GPU HBM → CPU DRAM → 3FS distributed storage, achieving cache hit rate 40%→80% and average TTFT −56% in Novita AI production; key technical contribution is Page-first CPU memory layout enabling zero-copy page-wise storage I/O paired with layer-wise GPU prefetch for computation overlap. GPU with 40GB HBM can effectively serve 200GB+ cache capacity via DRAM extension. — [[2025-12-14-阿里云-tair-联手-sglang-共建-hicache-构建面向-智能体式推]]
- Alibaba Cloud Beluga (arXiv:2511.20172) demonstrates that replacing RDMA-based disaggregated KVCache (Mooncake) with CXL-based shared memory pool (XConn XC50256 switches, up to 8TB pool at 1TB/s) reduces cache-hit TTFT by 89.6% and improves QPS 7.35×. Fundamental reason: CXL provides load/store semantics to GPU via `cudaMemcpy` P2P, eliminating RDMA's CPU-driven multi-hop data path and cross-component synchronization. — [[2025-12-10-较mooncake首token延迟直降89-6-阿里云提出基于cxl的kv缓存管]]
- DeepSeek-V3.2-Exp Latent Cache offload (ESS, Baidu AIAK): each entry is 656 bytes; scattered access via `cudaMemcpyAsync` achieves only 0.79 GB/s H2D; FlashTrans (UVA-based CUDA operator with address-driven on-demand transfer) achieves 37 GB/s H2D. LRU eviction + LRU-Warmup (last 32 Prefill windows' Top-2K indices) reduces early Decode Cache Miss. At 128K context, ESS achieves 123% throughput improvement at Sparse Memory Ratio 0.1. — [[2025-12-04-突破显存瓶颈-基于-deepseek-v3-2-exp-的-latent-cac]]
- [[vLLM]] PR #6496 (Jul 2024) demonstrated CPU offload as an alternative to KV cache eviction: using pinned CPU memory as a weight buffer (not KV buffer), hook `make_layers` to swap layer weights on-demand, conceptually extending GPU memory by `--cpu-offload-gb N` GB per device; compatible with CUDA graphs; GH200 test showed 8 min loading for 61 GB model weights at 70 GB offload. — [[2025-05-30-core-model-yet-another-cpu-offload-imple]]
- MLA的KV Cache压缩逻辑：decode阶段KV Cache使推理从计算密集型转为访存密集型；MLA将每Token完整KV（MHA基准16384维）压缩至c^{KV}+k^R（576维），通过矩阵吸收计算避免显式展开K/V，使H800 decode阶段FLOPs/byte约达242，进入compute-bound区间；KV Cache因此不再是显存和带宽的绑定约束。 — [[2025-06-05-deepseek技术解读-1-彻底理解mla-multi-head-latent]]

## Sources drawn on

- [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]] — analytical KV-bandwidth equations + the "datacenter bandwidth is sufficient" finding.
- [[2025-11-20-kvconnector-add-metrics-to-prometheus-gr]] — vLLM NIXL/KVConnectorStats observability for the KV-transfer data plane.
- [[2026-05-08-a-survey-of-llm-inference-systems]] — Pan+Li survey treating memory management as a first-class design axis with database-systems framing.
- [[2026-03-16-我们撞车了kimi的注意力残差-但用在压缩上-小红书]] — context compression via residual attention over frozen LLM hidden states, avoiding the progressive layer-dilution problem shared with [[Kimi K2]] Attention Residuals.
- Long-context KV-cache cost dominates 2026 open-weight design choices. Three orthogonal compression axes are now in production: per-layer reuse ([[Cross-Layer Attention]] in [[Gemma 4]]), per-token representation compression ([[MLA]]), and sequence-dimension compression ([[Compression Sparse Attention]] + [[Highly Compressed Attention]] in [[DeepSeek-V4]] — 7-10% of V3.2 cache size at 1M context). [[Compressed Convolutional Attention]] adds a fourth: operate on compressed tensors directly rather than decompress for the attention op. — [[2026-05-17-recent-developments-in-llm-architectures]]
- Context-offload pattern (Tencent's [[TencentDB Agent Memory]], 2026): the largest token consumers in long agent tasks are verbose intermediate logs (search results, code, error traces). Default thresholds — mild offload at 50% of context window, aggressive at 85%, Mermaid canvas budget capped at 20%. The Agent reasons over the canvas; raw evidence lives on disk under `refs/*.md` and is recalled via `node_id` grep. Different mechanism than per-token-representation compression (MLA) or sequence-dimension compression (DeepSeek V4 CSA/HCA) — a file-system + symbolic-graph approach rather than a kernel-level one. — [[2026-05-16-tencent-tencentdb-agent-memory-tencentdb]]
