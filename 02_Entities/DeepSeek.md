---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 24
tier: active
---

# DeepSeek

Chinese AI lab; produces open-weight frontier-grade MoE and dense models; published FlashMLA + DeepSeek-V3.

## Synthesis





DeepSeek is a Chinese AI lab distinguished by publishing not just model weights but the operational internals of its inference stack — kernel source, profiler traces (deepseek-ai/profile-data: `train.json` 112 SMs compute / 20 comm, `prefill.json` 108/24, `decode.json` SM-freeing AllToAll via DeepEP), and detailed architectural tech reports — at a depth unusual among frontier developers. Its V3/R1 serving infrastructure reflects deliberate co-design: no tensor parallelism on decode keeps h_q at 128, making MLA decoding compute-bound on H800 and justifying FlashMLA's seesaw schedule. The V3/R1 architecture (671B total, 37B active, MLA plus sparse MoE) became the 2025 reference architecture for large MoE, adopted directly by Kimi K2 (1T, 384 experts) and Mistral 3 Large; SGLang reproduced near-parity inference throughput at half the node count via PD disaggregation, EP72/EP32, EPLB, and DeepEP. V3.2-Exp (Sep 2025) added DeepSeek Sparse Attention (lightning-indexer + token-selector reducing attention from O(L²) to O(Lk=2048)) reusing MLA's compressed latents. The V4 architectural pivot (2026-04-24, image-receipts via an xhs interpretation piece pending direct verification against the V4 paper) retires MLA in favor of MHA+GQA with Compression Sparse Attention plus on-disk KV cache, claiming V4-Pro at 27% of single-token inference FLOPs and 10% of KV cache versus V3.2 at 1M-token context — encoding both a shift from per-token KV compression toward sequence-dimension sparsity and a decision to fuse Chat and Agent infrastructure into one model rather than fork by use-case.





## Observations

- FlashMLA documents a deliberate DeepSeek serving-economics choice: **no tensor parallelism on decode**, so `h_q = 128` and MLA decoding is compute-bound (not memory-bound) on H800. This shapes the kernel design — the seesaw schedule optimizes for compute-bound throughput, not memory-bandwidth. DeepSeek publishes the kernel source alongside the inference-system overview at github.com/deepseek-ai/open-infra-index. — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- **V4 architectural pivot** (2026-04-24, image-receipts via xhs interpretation piece): retired MLA, returned to MHA+GQA with **Compression Sparse Attention** + **on-disk KV cache** (compressed KV values stored on local SSD to eliminate repeated prefill for shared-prefix requests, V4 §3.3.2 / §3.6.2). Quantitative claims (verify against V4 paper when ingested): V4-Pro at 27% inference FLOPs + 10% KV cache vs V3.2 at 1M tokens. Bigger pattern beyond the numbers: the inventor of MLA chose to **fuse Chat and Agent infrastructure into one model** (unified Context + Attention + Token Scaling) rather than fork the architecture per use-case, and treats post-train compute as a co-equal scaling axis to pre-train — see V4 §3.5 *Scaling RL Framework for Million-Token Instruction-for-Agentic-AI*. — [[2026-04-27-deepseek-v4砍掉mla-一个月前有人预言了-小红书]]
- **Publishes PyTorch Profiler traces** for V3/R1 training + inference (deepseek-ai/profile-data, April 2026): `train.json` (EP64/TP1, DualPipe two-chunk overlap, 112 SMs compute / 20 SMs comm), `prefill.json` (EP32/TP1, 108/24 SM split, two-micro-batch attention-balanced overlap), `decode.json` (EP128/TP1, **SM-freeing AllToAll via DeepEP** — after RDMA messages issued, all SMs freed for compute). This is the deepest receipts-level publication of overlap strategy in the V3/R1 lineage. — [[2026-04-03-deepseek-ai-profile-data-analyze-computa]]
- Raschka's survey confirms DeepSeek V3 (671B, 37B active, MLA + sparse MoE) became the 2025 reference architecture for large MoE models: Kimi K2 (1T) and Mistral 3 Large (675B) both adopted it directly. DeepSeek's architectural influence pattern — publishing both weights and architectural details — enabled cross-lab adoption at unprecedented scale. GLM-4.5 also borrowed DeepSeek V3's 3-dense-prefix-layers pattern for early-layer training stability. — [[2026-01-28-the-big-llm-architecture-comparison]]
- **Inference stack replicated at scale by SGLang Team** (May 2025): SGLang achieves near-parity with DeepSeek's published V3 throughput on 12 × 8 H100 nodes by integrating DeepEP (two dispatch modes), DeepGEMM (phase-specific grouped GEMMs), and EPLB (288 experts for non-power-of-2 EP sizes). DeepEP normal dispatch (prefill) + low-latency dispatch (decode) cannot coexist in a unified scheduling engine — PD disaggregation is required, not merely beneficial, at this scale. Published open-source with full reproduction instructions. — [[2025-09-05-deploying-deepseek-with-pd-disaggregatio]]
- **V3.2 release lineage** (Raschka deep-dive, Jan 2026): V3.2-Exp (Sep 2025) added DeepSeek Sparse Attention (DSA — lightning-indexer + token-selector, reduces attention from O(L²) to O(Lk=2048)); V3.2 (Dec 1, 2025) kept DSA and added self-verification/self-refinement from DeepSeekMath V2 plus GRPO stability updates (domain-specific KL, unbiased KL, off-policy masking, MoE routing replay). V3.2 is a hybrid instruct/reasoning model; V3.2-Speciale is an extended-thinking variant. DeepSeek returned to NVIDIA chips for V3.2 after alleged Huawei experimentation. — [[2025-12-04-a-technical-tour-of-the-deepseek-models-]]
- [[DeepEP]] source code uses three communication modes; intranode NVLink peer-memory access via virtual addressing (no `cudaMallocManaged`); internode via NVSHMEM `nvshmem_int_put_nbi`; queue-based buffer design (saves memory, adds complexity; fixed-buffer alternative in issue #39); Hopper-specific PTX `ld.global.nc.L1::no_allocate` for volatile reads exploiting Hopper's unified nc+L1 cache. — [[2025-10-09-deepseek-deepep源码分析]]
- [[DeepEP]] 技术概述（AI闲谈版）：专为 DeepSeek-V3/R1 的 MoE EP 通信设计，高吞吐 Kernel 用于训练/Prefill（IB 关 AR，warp specialization，20 SM 默认），低时延 Kernel 用于 Decoding（IBGDA，纯 RDMA，Receiving Hook 异步 overlap），FP8 Dispatch 减半通信量，IB VL 流量隔离防止不同 Workload 相互干扰。 — [[2025-10-09-deepseek-开源系列之-deepep-介绍]]
- [[DeepSeek-V3.2]] 引入 DeepSeek Sparse Attention（DSA），三算子实现：Lightning Indexer（FP8 GEMM 快速相似度筛选）、Top-k Selector（O(N) Radix Sort 两阶段，避免全序列排序）、Sparse MLA（仅对 top-k KV 位置计算注意力，O(seq_len×topk)）；[[TileLang]] 被用于这些算子的高效内核实现。 — [[2025-10-09-从deepseek-v3-2-dsa算子看tilelang编译器的细节]]
- DeepSeek V3's [[MLA]] config (dim=7168, n_heads=128, q_lora_rank=1536, kv_lora_rank=512, qk_nope_head_dim=128, qk_rope_head_dim=64, v_head_dim=128) is fully detailed in a naive-to-optimized PyTorch walkthrough; V3 uses FP8 block-wise quantization for all linear layers, requiring CUTLASS block-wise GEMM rather than PyTorch 2.6's `torch._scaled_mm` which only supports tensor-wise and row-wise FP8 GEMM. — [[2025-06-16-细数deepseek-mla-layer从naive实现开始的5大优化策略]]
