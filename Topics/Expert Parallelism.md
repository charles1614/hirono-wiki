---
created: 2026-05-12
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: topic
source_count: 17
---

# Expert Parallelism

## What

MoE-specific parallelism strategy that distributes experts across devices, with AllToAll dispatch/restore around per-device expert compute.

## Current understanding

**Expert Parallelism (EP)** is the MoE-native parallelism dimension that distributes distinct expert weight matrices across devices so that each GPU holds only a subset of experts. During a forward pass, a router assigns each token to its top-K experts; an **AllToAll collective** dispatches tokens to the devices that own those experts, the assigned GPUs run dense FFN compute locally, and a second AllToAll restores outputs to the originating devices. The pattern exists because dense TP over all experts would saturate inter-node links at scale — EP keeps most expert compute intra-device while concentrating communication into two symmetric collectives per MoE layer.

The core tension in EP is that it interacts with every other parallelism axis. Prior frameworks nested the EP group as a sub-group of data parallelism, imposing a hard cap `max(EP) ≤ DP`. [[2025-10-28-moeparallel-folding-heterogeneous-parall]] (MoE Parallel Folding, NVIDIA/Megatron-Core) breaks this ceiling by **decoupling the parallelism mappings of attention and MoE layers**: attention uses a `TP × CP × DP × PP` 4-D group; MoE layers independently use `TP × EP × DP × PP`. The only invariant is that PP groups must match between the two. This lets EP scale beyond the DP bound and, critically, lets the two layer types each sit inside high-bandwidth NVLink domains rather than crossing slower inter-node links. The result is 49.3% MFU on Mixtral 8×22B and 39.0% MFU on Qwen2-57B-A14B at 1,024 H100 GPUs.

EP degree differs substantially between prefill and decode. DeepSeek's published profiler traces [[2026-04-03-deepseek-ai-profile-data-analyze-computa]] show V3/R1 prefill running at EP32 and decode at EP128 — wider EP in decode is economic because each decode step is cheap and more parallelism reduces per-token latency without increasing cross-layer coordination overhead. The same traces show a complementary **SM-lane partitioning strategy**: 112 SMs allocated to compute, 20 SMs to communication, running on disjoint SM pools rather than serializing. For decode, the AllToAll is issued over RDMA, SMs are immediately freed, and compute runs until the collective completes — the DeepEP library implements this SM-freeing mechanism.

Overlapping the two AllToAll collectives with FFN compute is the main systems challenge after EP degree selection. MoE Parallel Folding's flexible dispatcher handles both token-dropping and token-dropless training under arbitrary EP combinations; DeepSeek's training profile uses DualPipe's two-chunk overlap (Dispatch F/B and Combine F/B interleaved with forward and backward FFN chunks). In inference, Ant Group's H20-96G production deployment [[2026-05-06-蚂蚁开源-x-sglang-meetup技术回放解读系列之面向deepseek系]] demonstrates single-batch overlap (SBO) between AllToAll dispatch/combine and GEMM computation, explicitly rejecting Two-Batch Overlap (TBO) for adding control-plane complexity with marginal gain at H20's lopsided compute-to-bandwidth ratio.

Expert placement within EP groups is a secondary optimization. Ant's EPLB PR uses a real-traffic co-activation matrix — rather than random expert assignment — to ensure frequently co-firing experts land on the same physical node, reducing cross-node RDMA traffic (the H20's short pole). [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] (TRT-LLM on gpt-oss-120b) captures a practical constraint: the CUTLASS MoE backend supports **pure EP only** (no mixed TP/EP), so max-throughput configurations set `--ep ${num_gpus}` and forego TP within MoE layers, while low-latency configurations use the TRTLLM backend which supports mixed TP/EP but with smaller recommended EP to avoid routing load-imbalance amplifying tail latency.

The load-bearing primitives, in order of architectural significance: (1) the AllToAll dispatch / expert compute / AllToAll restore three-stage flow as the EP execution primitive; (2) EP degree as a separate tuning knob from DP, decoupled by per-layer parallelism mapping; (3) SM-disjoint compute and communication lanes enabling true overlap; (4) expert placement (EPLB) as a topology-aware second-order optimization once EP degree and overlap are locked.

## Open threads

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

## Observations

- [[DeepEP]] low-latency kernel for decode All-to-All: uses NVSHMEM IBGDA, pre-allocated buffers, two-phase send/recv design; IBGDA achieves ~64 µs vs IBRC's 128–256 µs for <8 KiB messages; `recv_hook=true` releases SMs after send (~10 µs) for compute overlap during RDMA transit. — [[2025-10-09-xzwazsg-zjcksvuvksvw]]
- [[DeepEP]] intranode uses NVLink peer memory access (virtual addressing, no cudaMallocManaged); internode uses NVSHMEM; supports three modes: high-throughput NVLink, high-throughput RDMA, low-latency RDMA with Adaptive Routing. — [[2025-10-09-deepseek-deepep源码分析]]
- Alibaba [[RTP-LLM]] on RoCE: Prefill EP=32, Decode EP=144 (128+16 redundant); EPLB load balance test-data-sensitive; dual-uplink RoCE fix via NVSHMEM-level message/queue-level load balancing reduces Low Latency mode latency 60%+; Combine phase (FP16) is ~2× longer than Dispatch (FP8). — [[2025-10-09-如何重现-deepseek-推理性能突破]]
- [[Moonshot AI]] K2VV reveals vendor tool-call accuracy variance for [[Kimi K2]] serving at EP scale: official API 100%, vLLM/SGLang open-source deployments 73–95% schema accuracy; root causes include wrong model versions, malformed tool IDs, and absent guided encoding. — [[2025-10-12-moonshotai-k2-vendor-verifier-verify-pre]]
- [[DeepEP]] 在 H800 集群上将 EP AlltoAll 带宽推至接近物理极限（节点内 ~160 GB/s NVLink，节点间 ~50 GB/s IB），两种 Kernel 分别服务 Prefill/Training（高吞吐）和 Decoding（低时延）；在 RoCE 环境中由于 incast、Multi-Rail/Rail-Only 拓扑兼容性等问题仍存在实质性障碍，[[SGLang]] 目前在 RoCE 上用 AG+AR 规避 AlltoAll。 — [[2025-10-09-分析一下ep并行和deepseek开源的deepep代码]]
