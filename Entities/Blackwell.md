---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 37
tier: active
---

# Blackwell

NVIDIA's 2024 GPU architecture; B100/B200/B300/GB200; first NVFP4 native silicon.

## Synthesis


NVIDIA's Blackwell generation (B200/B300/GB200/GB300) is the first architecture with native FP4 Tensor Cores, enabling NVFP4 pretraining — a 12B-parameter model trained on 10 trillion tokens in 4-bit floating-point that matches FP8 training loss, the longest 4-bit pretraining run publicly documented. In inference, Blackwell is the primary target for TensorRT-LLM 1.1.0rc1's gpt-oss-120b deployment, with a GB200 NVL72 system delivering over 1.5 million tokens per second system-wide at max-throughput (>20k tps/gpu on 4× GB200 with DP4EP4). It also serves as the hardware baseline for NVIDIA's systematic 100k+ design-point disaggregation study, where DeepSeek-R1 and Llama-3.1-70B/405B are simulated on Blackwell FP4 to map the Pareto frontier between disaggregated and co-located serving. On the software side, CUDA 13.1 introduces two Blackwell-specific platform features: MLOPart (Memory Locality Optimization Partition, presenting one GPU as multiple memory-locality-optimized CUDA devices on compute capability 10.0/10.3 B200/B300 today, with GB200/GB300 planned) and cuBLAS FP32/FP64 Tensor-Core emulation targeting GB200 NVL72 and RTX PRO 6000 Blackwell Server Edition.


## Observations

- Blackwell MXFP8 训练开销分析：以典型 MoE 矩阵乘法为例，计算 1.16ms，但量化+写回需搬运约 2.9 GB 数据，耗时 0.44ms（占 38%）；反向传播中转置-量化开销翻倍至 0.88ms（占 76%），因 Blackwell FP8 张量核心吞吐翻倍但 CUDA core 仅提升约 33%，反量化速度严重滞后于计算速度。 — [[2025-08-28-深度解析-deepseek为什么要推ue8m0-fp8]]
- Primary target architecture for gpt-oss-120b deployment in TensorRT-LLM 1.1.0rc1 (B200/GB200/H200 hardware). Headline benchmark: **GB200 NVL72 delivers >1.5M tps system-wide** at max-throughput. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- Vera Rubin NVL72 claims 1/4 the GPU count for MoE training and 1/10 cost per token for agentic inference (Kimi-K2-Thinking, 32K/8K ISL/OSL) relative to Blackwell NVL72; built on the same third-generation MGX NVL72 rack form factor, offering a "seamless transition" from prior generations. — [[2026-01-26-nvidia-vera-rubin-nvl72-co-designed-infr]]
- Used as the hardware baseline for the disaggregation systematic study's 100k+ design-point sweep — DeepSeek-R1 / Llama-3.1-70B/405B simulated on Blackwell + FP4 precision. — [[2025-10-09-beyond-the-buzz-a-pragmatic-take-on-infe]]
- CUDA 13.1 introduces Blackwell-specific platform features: **MLOPart** (Memory Locality Optimization Partition; compute capability 10.0/10.3 on B200/B300 today, GB200/GB300 planned) presents one underlying GPU as multiple memory-locality-optimized CUDA devices. cuBLAS FP32/FP64 Tensor-Core emulation targets GB200 + RTX PRO 6000. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- The native-FP4 platform that NVFP4 pretraining validates — Blackwell's FP4 Tensor Cores enable the 4-bit training path matching FP8 quality at 12B/10T-token scale. — [[2026-02-04-pretraining-large-language-models-with-n]]
- Epoch.ai spec dataset (175 accelerators): Blackwell Ultra (GB300, Aug 2025) tops the chart at 5.0 PFLOP/s FP8 / 8 TB/s BW / 288 GB HBM at 1400 W; GB200 (Feb 2025) at 5.0 PFLOP/s FP8 / 8 TB/s / 186 GB at 1200 W; B200 (Nov 2024) at 4.5 PFLOP/s / 7.7 TB/s / 180 GB at 1000 W. FP8 now present on all Blackwell variants. — [[2026-01-22-data-on-machine-learning-hardware]]
- FA4 kernel targets Blackwell (sm100/compute capability 10.0) using `tcgen05.mma.cta_group::1` PTX (5th-gen Tensor Core); uses single-CTA execution (not 2SM/2CTA TPC-based) to simplify scheduling, with StaticPersistentTileScheduler for at-most-one-CTA-per-SM dispatch. — [[2026-02-07-解析flash-attention-4-fa4-blackwell-核心实现与架]]
- SemiAnalysis TCO comparison with [[Ironwood]]: GB200 server all-in cost ~44% higher than Ironwood (from Google's procurement cost perspective). Marketed Blackwell peak FLOPs are inflated by DVFS — actual utilization lands in the 70s% of rated peak. GB300 has 288 GB 12-Hi HBM3E vs Ironwood's 192 GB 8-Hi — the key remaining hardware advantage for large-KV-cache inference use cases. — [[2026-01-22-google-tpuv7-the-900lb-gorilla-in-the-ro]]
- [[vLLM]] Wide-EP on GB200 achieves 26.2K prefill TPGS / 10.1K decode TPGS for DeepSeek MoE (3–5× over H200); `gpt-oss-120b` optimization achieves 38% higher max throughput and 13% lower min latency vs InferenceMAX baseline. Host CPU bottleneck is a distinctive Blackwell characteristic — GPU executes so fast that async scheduling + Stream Interval are required to eliminate CPU-side gaps between kernel launches. — [[2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par]]
- [[FlashMLA]] SM100/Blackwell kernel targets: dense prefill via CUTLASS (1460 TFlops fwd / 1000 TFlops bwd on B200); sparse decode SM100 with head64/head128 + `fwd_for_small_topk` variant; sparse prefill SM100 with head64/head128 specialization. — [[2026-01-30-deepwiki-flashmla-03-kernel-implementati]]
- Blackwell（5th gen TC，`tcgen05.mma`）架构要点：256KB TMEM（Tensor Memory，与 register file 同大小）专用于 TC 操作，操作数全移出 register（A→SMEM，D→TMEM）；MMA.2SM 在 CTA pair 粒度跨 2 SMs 共享 B 矩阵，每 SM 的 SMEM 需求减半，等效 SMEM 翻倍；支持 MXFP8/6/4 和 NVFP4（4:8 pair-wise 结构化稀疏）；CC 10.0（B200/GB200），CC 10.3（GB300/B300）。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- B200 (`sm_100a`) benchmarked for FP4 MoE inference: [[SGLang]] achieves 1168 TFLOPS vs [[vLLM]] 1026 TFLOPS (142 TFLOPS gap) on GPT-OSS-20B. The Blackwell-native [[CUTLASS]] schedule `KernelPtrArrayTmaWarpSpecialized1SmNvf4Sm100` requires 128-byte TMA alignment enforced via padding; generic CUTLASS 3.x without this padding risks TMA stalls. B200 has 142 SMs — at batch size 1, only 2 thread blocks would be launched with 128-token tiling, leaving 98.6% of SMs idle without adaptive grid sizing. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
- Blackwell B200 is a dual-die package (208B transistors, TSMC 4N); each die ≈1.25× H100 compute → 2 dies ≈2.5× H100 dense FP16. 8×B200 (HGX) = 36P sparse FP16, approximately 2.25× 8×H100/H200; B100 = ~3/4 of B200 (28P). Gen-5 NVLink doubles per-port bandwidth from 50 GB/s to 100 GB/s per lane; 4th-gen [[NVSwitch]] supports 576 GPUs at 1 PB/s. GTC data: 3× training (GPT-MoE-1.8T, 4096 HGX B200 vs H100), 15× inference on 8 systems (3.5→58 tok/s) using FP4+NVL72 full fabric. — [[2026-01-12-analysis-of-nvidia-s-latest-hardware-b10]]
