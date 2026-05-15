---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 8
tier: active
---

# Tensor Core

NVIDIA's matrix-multiply accelerator unit on Volta+ GPUs; 4 generations (Volta, Turing, Ampere, Hopper); extended in Blackwell.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Volta（1st gen）每 SM 8 个 Tensor Core，MMA 作用域为 8 线程 quadpair，执行 8×8×4 矩阵乘；HMMA 引入动机是摊销每条指令 ~30pJ 发射开销（相比 HFMA 1.5pJ，20× 差）；Ampere（3rd gen）升为 warp 级（32 线程），引入 `ldmatrix` 和 `cp.async`；Hopper（4th gen）升为 warpgroup 级 128 线程 `wgmma`，操作数 B 直接从 SMEM 读；Blackwell（5th gen，`tcgen05.mma`）单线程语义，操作数全移至 SMEM/TMEM，支持 MMA.2SM 跨两个 SM 共享 B 矩阵。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- Tensor Core 尺寸的增长策略：矩阵乘算术强度随问题规模 O(n) 线性增长（计算 O(n³)、数据移动 O(n²)），这激励 NVIDIA 优先扩大 TC 尺寸而非数量，但大 TC 加剧 wave quantization（工作单元不整除时利用率骤降），对小矩阵效率尤差。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- Tensor Core 吞吐每代翻倍，全局内存延迟未降反升，staging buffer（SMEM）必须随之增大；Blackwell SMEM 未增是因为 tcgen05 MMA.2SM 跨 2SM，等效容量翻倍；Blackwell 新增 256KB TMEM（与 register file 同大），操作数 D 始终驻 TMEM（D tile 被访问 2Kt 次，A/B tile 各 1 次），功耗效率更高。 — [[2026-01-15-nvidia-tensor-core-evolution-from-volta-]]
- Concise reference cross-generation: V100 (128 FP16 FLOPS/clock/core, 8 cores/SM, 80 SMs), A100 (512 FP16 + 32 FP64 FLOPS/clock/core, 4 cores/SM, 108 SMs, adds BF16/TF32/INT8/FP64), H100 (1024 FP16 + 64 FP64 FLOPS/clock/core, 4 cores/SM, 132 SMs, adds FP8 E4M3/E5M2); total FLOPS = m×n×2k. SDK exposes logical sizes; CUDA runtime maps to hardware MMA dimensions. — [[2025-11-06-tensor-cores-and-matrix-cores]]
- 五代架构演进概述（通俗视角）：Volta FP16 指令开销 20×（30pJ vs 1.5pJ），HMMA+TC 吞吐提升 8×；Turing 引入 INT8/INT4 和结构化稀疏（硬件 2× 性能）；Ampere `cp.async` 异步数据复制（DRAM→SMEM 绕开寄存器）+ Warp 级 MMA（2048 FP16 FLOP/周期/SM）；Hopper CGA+DSMEM+TMA+FP8+wgmma（H200 4.8 TB/s HBM，LLM 推理速度 30×）；Blackwell TMEM 256KB+CTA对+MMA.2SM+NVFP4（32768 FP4 FLOP/周期 跨 2SM）。 — [[2025-09-20-tensor-core-从-volta-到-blackwell-的进化]]
