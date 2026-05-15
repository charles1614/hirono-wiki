---
created: 2026-05-11
updated: 2026-05-15
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 15
tier: active
---

# NVFP4

NVIDIA's 4-bit floating-point format introduced with Blackwell; positioned as the next standard low-precision training format after FP8.

## Synthesis


NVFP4 is NVIDIA's 4-bit floating-point format introduced on Blackwell (B200/GB200) tensor cores, distinct from generic E2M1 FP4 through its specific block-scale and scale-factor encoding. A September 2025 NVIDIA paper (89 authors, arXiv:2509.25149) provides the first publicly documented 12B-parameter LLM pretrained end-to-end on 10 trillion tokens in 4-bit precision, matching FP8 training loss and downstream accuracy — the longest 4-bit pretraining run ever published. The method rests on four ingredients: Random Hadamard transforms applied per-block to bound outliers before quantization, a two-dimensional quantization scheme that keeps forward and backward representations consistent (prior FP4 approaches failed on the backward path because matmul transposes alter scale structure), stochastic rounding to keep gradient updates unbiased across millions of steps, and selective retention of high-precision BF16/FP8 for stability-critical operators such as embedding, layer-norm, and final softmax. Because FP4 doubles arithmetic density on tensor-core hardware relative to FP8, a successful pretraining path at this scale directly reshapes throughput-per-dollar projections for frontier training runs on Blackwell.


## Observations

- In [[vLLM]] Wide-EP on [[GB200]]: NVFP4 GEMM applied to MoE expert weights and O-proj via FlashInfer TRTLLM-Gen kernels; NVFP4 MoE dispatch quantizes token activations to FP4 before all-to-all communication, reducing inter-GPU communication volume 4× vs FP16 dispatch; weights stored in packed 4-bit format with per-group scaling factors, dequantized on-the-fly inside tensor cores. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- Rubin GPU delivers 50 PFLOPS NVFP4 inference vs. 35 PFLOPS NVFP4 training; a NVIDIA TransformerEngine team member explains the gap: inference uses calibrated static tensor-wide scaling factors enabling aggressive kernel fusion, while training must compute scaling factors dynamically per quantization call, limiting fusions; additionally, Random Hadamard Transformations apply only in the training backward pass, absent from inference. Underlying GEMM performance is identical — the throughput difference is recipe-driven. — [[2026-01-27-why-nvfp4-inference-50-pflops-outperform]]
- Rubin NVL72 rack delivers 3,600 PFLOPS NVFP4 inference (50 PFLOPS per GPU); full specs: 20.7 TB HBM4 at 1,580 TB/s, 260 TB/s NVLink 6 scale-up bandwidth per rack. Training at 2,520 PFLOPS NVFP4 (35 PFLOPS per GPU). — [[2026-01-26-nvidia-vera-rubin-nvl72-co-designed-infr]]
- The four-ingredient method that makes 4-bit pretraining work: (1) Random Hadamard transforms per-block to bound outliers; (2) 2-D quantization scheme for forward/backward consistency (prior FP4 schemes failed on the backward path because matmul transposes change scale structure); (3) stochastic rounding for unbiased gradients across millions of steps; (4) selective high-precision layers for the stability-critical operators (embedding, layer-norm, final softmax). Validated at **12B parameters × 10T tokens** — longest 4-bit pretraining run publicly documented. — [[2026-02-04-pretraining-large-language-models-with-n]]
- NVFP4 精度优于 MXFP4 的推测原因：更小的 block size、不同的 scaling factor 数据格式、以及两级量化方法；Blackwell 5th-gen TC 引入 4:8 pair-wise 结构化稀疏（每 8 元素分 4 对，恰好 2 对非零），因为 NVFP4 是 sub-byte 数据类型，pair-wise 约束与 2:4 相比并非更宽松的剪枝条件。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- NVFP4 MoE (GPT-OSS-20B, 32 experts, top-4) single-card benchmarks on [[Blackwell]] B200: [[SGLang]] 1168 TFLOPS, FlashInfer CuteDSL 1156 TFLOPS, [[vLLM]] 1026 TFLOPS. The 142 TFLOPS gap between SGLang and vLLM is attributable to kernel fusion (21.9% activation memory reduction), Blackwell-native [[CUTLASS]] schedule with TMA + FP4 warp specialization, and adaptive grid sizing for small-batch SM occupancy. — [[2026-01-06-142-tflops-的差距-为什么在-blackwell-上-fp4-moe-]]
