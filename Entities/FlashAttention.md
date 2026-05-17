---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 18
tier: active
---

# FlashAttention

The original IO-aware fused attention kernel (Dao et al.); v1/v2/v3; foundation for most modern attention kernel work.

## Synthesis





FlashAttention established the online-softmax-plus-tiled-accumulation algorithm that fuses attention into a single SRAM-resident kernel, reducing intermediate memory from O(N²) to O(N) — in Megatron-LM's measured example, from 2.1 GB to 134 MB at batch=8, heads=32, seq=2048. The third-generation variant adapted this for Hopper via TMA async loads and WGMMA warpgroup MMA but still achieves only ~35% H100 utilization (versus 80–90% for tuned GEMM), partly because its ping-pong schedule requires two output matrices per SM — a register budget FlashMLA's 64×512 MLA output cannot afford. FA-4, targeting Blackwell, extends the design with five warp specialization roles, software polynomial exp approximation via Horner's method to reduce the SFU bottleneck, and online softmax that cuts rescaling operations by 90%, achieving ~20% improvement over cuDNN 9.11.0's best attention kernel. A non-obvious finding from HKUST's Hopper microbenchmark is that Transformer Engine's `DotProductAttention` routes through flash-attention rather than FP8 tensor cores, so attention doesn't benefit from FP8 acceleration in the standard TE path — explaining why FP8 LLM speedups fall short of the 2× peak rates the spec sheet implies. ThunderKittens' motivation document cites FA-2's 47% performance drop on H100 and FA-3's two-year adaptation lag as the primary friction driving a new abstraction layer; across the corpus, FlashAttention functions less as a finished artifact than as the algorithmic substrate that newer kernels either extend (FlashMLA's seesaw schedule) or route around (TE's FP8 bypass) depending on hardware register and bandwidth constraints.





## Observations

- Used as the kernel-design reference point for FlashMLA's seesaw schedule. FlashMLA's writeup credits FlashAttention's online softmax + accumulation approach as the algorithmic basis the seesaw schedule extends; FA-3 specifically is the comparison for why the seesaw is needed (FA-3's ping-pong needs two output matrices per SM, blocked by Hopper's register budget for 64×512 MLA outputs). — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- HKUST Hopper microbench finding: Transformer Engine's `DotProductAttention` operator uses flash-attention instead of FP8 Tensor Cores. So attention doesn't get FP8 acceleration in TE — a non-obvious finding that explains why FP8 LLM speedups don't match the 2× peak rates suggest. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- FA4 (Blackwell-targeted) achieves ~20% improvement over cuDNN 9.11.0's best attention kernel. Key innovations: warp specialization with 5 warp roles (Load/MMA/Softmax/Correction/Epilogue), a software polynomial exp approximation replacing SFU calls via Horner's method, and an online Softmax that reduces rescaling operations by 90% by only triggering when the running max changes enough to affect numerical stability. — [[2026-02-07-解析flash-attention-4-fa4-blackwell-核心实现与架]]
- Claude Code (Opus 4.6) autonomously produced a CUDA Flash Attention with custom mask kernel that outperforms the standard Triton FlashAttention baseline by 46.7% on RTX 3080 (25.17 TFLOPS, MFU 42%), via 25 AutoResearch-style iterations with self-directed ncu profiling and PTX analysis. Confirms that FlashAttention is the reference baseline for custom mask attention kernels on consumer hardware. — [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]]
- [[Megatron-LM]]'s `DotProductAttention` selects FlashAttention as the default backend for production runs on A100/H100 (O(N) memory, 2–4× speedup); standard attention materializes an [B, H, S, S] tensor (example: 2.1 GB at batch=8, heads=32, seq=2048) which FlashAttention reduces to 134 MB — a 16× savings by tiling in SRAM. — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
- In [[SGLang]] Diffusion for Qwen-Image-Edit-2511: sgl-kernel FA3接口比上游flash-attention官方FA3接口慢 (1.7ms vs 1.2ms/step on H100)；差异可在Nsight Systems中通过固定同一step同一layer的flash attention kernel时间点来观察；切换到上游接口是PR #15812三个优化之一。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
- Meituan (Longcat) found FlashAttention backward gradient computation specifically sensitive to SDC in production LLM training
- SWIFT's Ring-Attention backward recomputes flash_attn_forward during backward to retrieve block LSE and Attention-Out rather than storing them in ctx; the ring LSE/Out update equations are mathematically equivalent to FlashAttention's online-softmax block-update recurrence. — [[2025-11-10-超长序列并行之ulysses-ring-attention技术原理与实现]]
- ThunderKittens（2024年10月，HazyResearch）以简化FlashAttention实现为主要设计目标之一：相比FA1/FA2/FA3，TK的FlashAttention实现load/compute/epilogue结构分离，大幅减少手写异步同步编排代码；文章还指出FlashAttention-2在H100上性能下降47%、FA-3耗时两年才适配H100是TK诞生的核心动机之一。 — [[2026-01-13-深入解读thunderkittens-兼顾cutlass性能与tilelang易]], prompting addition of custom SDC detection probes to their training stack. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]
- Pedagogical derivation explains how standard Attention materializes [SL, SL] intermediate tensors `s` and `p` to HBM — these dominate latency because SL >> D. FlashAttention eliminates them by (1) kernel fusion keeping intermediates in SRAM, (2) tiling so one GPU unit handles one query, (3) streaming K/V with a loop of length SL, and (4) deferring softmax division until after the K/V loop (insight: softmax division does not affect QK·V order). — [[2025-08-24-不会-cuda-也能轻松看懂的-flashattention-教程-算法原理篇]]
- FlashAttention-V3 reframes as a Hopper GPU adaptation of V2 rather than an algorithmic innovation: adopts TMA for async producer warpgroup data load (gmem→smem), WGMMA for consumer warpgroup matmul+softmax, and inter/intra-warpgroup GEMM-softmax overlap scheduling. FA-V2 achieves only ~35% utilization on H100 vs 80–90% for optimized GEMM kernels; V3 closes this gap via warp-specialized pingpong scheduling and FP8 support. — [[2025-05-26-flashattention-v3解读之hopper-gpu版flashatte]]
- FA3 FP8 specifics: block quantization (128×128 blocks, each with its own scale); wgmma layout incompatibility between FP8 accumulator and FP8 operand A (non-contiguous vs contiguous thread ownership) fixed by CUTLASS 3.5+ `permutationLayout`; V matrix transpose on Hopper done via LDSM_T → STSM_N in shared memory. Inter-WG and intra-WG overlap apply to both FP8 and FP16/BF16. — [[2025-05-26-flashattention-v3解读之fp8-fp16-bf16关键细节实现-]]
