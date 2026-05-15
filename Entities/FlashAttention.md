---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 11
tier: active
---

# FlashAttention

The original IO-aware fused attention kernel (Dao et al.); v1/v2/v3; foundation for most modern attention kernel work.

## Synthesis


FlashAttention established the online-softmax-plus-accumulation algorithm that became the standard reference for fused attention kernels, and its third-generation variant (FA-3) introduced the ping-pong scheduling technique — interleaving two output matrices across warpgroups to overlap CUDA-core and Tensor-Core work — that defines the current baseline for Hopper-era attention kernel design. FlashMLA's seesaw schedule is a direct response to FA-3: the 64x512 MLA output matrix requires 32,768 registers (half the SM's file), making a second output buffer impossible, so DeepSeek's kernel vertically splits the output instead while preserving mathematical equivalence to FlashAttention's online softmax. A less obvious finding from the HKUST Hopper microbenchmark study is that Transformer Engine's DotProductAttention operator routes through flash-attention rather than FP8 Tensor Cores, meaning attention does not benefit from FP8 acceleration in the standard TE path — one concrete reason why FP8 LLM speedups fall short of the 2x peak rates that tensor-core specs would suggest. Together, these two sources position FlashAttention less as a finished artifact and more as the algorithmic substrate that newer kernels extend or route around, depending on the hardware constraints of the target regime.


## Observations

- Used as the kernel-design reference point for FlashMLA's seesaw schedule. FlashMLA's writeup credits FlashAttention's online softmax + accumulation approach as the algorithmic basis the seesaw schedule extends; FA-3 specifically is the comparison for why the seesaw is needed (FA-3's ping-pong needs two output matrices per SM, blocked by Hopper's register budget for 64×512 MLA outputs). — [[2026-01-28-flashmla-docs-20250422-new-kernel-deep-d]]
- HKUST Hopper microbench finding: Transformer Engine's `DotProductAttention` operator uses flash-attention instead of FP8 Tensor Cores. So attention doesn't get FP8 acceleration in TE — a non-obvious finding that explains why FP8 LLM speedups don't match the 2× peak rates suggest. — [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]]
- FA4 (Blackwell-targeted) achieves ~20% improvement over cuDNN 9.11.0's best attention kernel. Key innovations: warp specialization with 5 warp roles (Load/MMA/Softmax/Correction/Epilogue), a software polynomial exp approximation replacing SFU calls via Horner's method, and an online Softmax that reduces rescaling operations by 90% by only triggering when the running max changes enough to affect numerical stability. — [[2026-02-07-解析flash-attention-4-fa4-blackwell-核心实现与架]]
- Claude Code (Opus 4.6) autonomously produced a CUDA Flash Attention with custom mask kernel that outperforms the standard Triton FlashAttention baseline by 46.7% on RTX 3080 (25.17 TFLOPS, MFU 42%), via 25 AutoResearch-style iterations with self-directed ncu profiling and PTX analysis. Confirms that FlashAttention is the reference baseline for custom mask attention kernels on consumer hardware. — [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]]
- [[Megatron-LM]]'s `DotProductAttention` selects FlashAttention as the default backend for production runs on A100/H100 (O(N) memory, 2–4× speedup); standard attention materializes an [B, H, S, S] tensor (example: 2.1 GB at batch=8, heads=32, seq=2048) which FlashAttention reduces to 134 MB — a 16× savings by tiling in SRAM. — [[2026-01-21-deepwiki-megatron-lm-12-attention-mechan]]
- In [[SGLang]] Diffusion for Qwen-Image-Edit-2511: sgl-kernel FA3接口比上游flash-attention官方FA3接口慢 (1.7ms vs 1.2ms/step on H100)；差异可在Nsight Systems中通过固定同一step同一layer的flash attention kernel时间点来观察；切换到上游接口是PR #15812三个优化之一。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
- Meituan (Longcat) found FlashAttention backward gradient computation specifically sensitive to SDC in production LLM training
- ThunderKittens（2024年10月，HazyResearch）以简化FlashAttention实现为主要设计目标之一：相比FA1/FA2/FA3，TK的FlashAttention实现load/compute/epilogue结构分离，大幅减少手写异步同步编排代码；文章还指出FlashAttention-2在H100上性能下降47%、FA-3耗时两年才适配H100是TK诞生的核心动机之一。 — [[2026-01-13-深入解读thunderkittens-兼顾cutlass性能与tilelang易]], prompting addition of custom SDC detection probes to their training stack. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]
