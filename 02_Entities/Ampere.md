---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 5
tier: active
---

# Ampere

NVIDIA GPU architecture (compute capability 8.0/8.6), A100 generation.

## Synthesis



NVIDIA's Ampere is the third-generation Tensor Core architecture (A100, 2020): MMA scope moved from Volta's 8-thread quadpair to warp scope (32 threads), with 4 TCs per SM delivering 512 FLOPs/cycle (2× Volta). The architecture introduced `ldmatrix` for wide vector loads matching TC data layout, `cp.async` for async DRAM→SMEM copy bypassing the register file to reduce register pressure, BF16 support (FP32-equivalent exponent range with 7-bit mantissa, eliminating need for loss scaling), and 2:4 structured sparsity with theoretical 2× throughput — though in practice 2:4 sparsity is rarely used in Western AI lab production inference. Ampere also expanded Tensor Core precision support beyond Volta's FP16/FP32 to include INT8, INT4, FP64, BF16, TF32, and sparsity — with Hopper subsequently adding FP8 as the qualitative jump for LLM workloads. Limited corpus evidence beyond architectural taxonomy in this batch — Ampere appears primarily as a cross-generation reference point in the HKUST Hopper microbenchmark study and in NVLink-generation enumeration.



## Observations

- Ampere（3rd gen TC）：MMA 升为 warp 级（32 线程），每 SM 4 个 TC，512 FLOPs/cycle（Volta 的 2×）；引入 `ldmatrix` 宽向量加载匹配 TC 数据布局；异步数据拷贝 `cp.async` 直接从 DRAM 写 SMEM 绕过 register file，降低 register pressure；BF16 支持（同 FP32 指数范围，7-bit mantissa，无需 loss scaling）；2:4 结构化稀疏理论 2× 吞吐但生产推理中几乎不被西方 AI 实验室使用。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
