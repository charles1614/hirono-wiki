---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 2
tier: seen
---

# DeepGEMM

NVIDIA/DeepSeek open-source high-performance GEMM kernel library for FP8 matmul

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Tencent [[HPC-Ops]] GroupGEMM outperforms DeepGEMM v2.2.0 by up to 1.88× at batch≤64; maintains ~1.1× advantage at large batch. HPC-Ops additionally closes the gap between Blockwise and PerTensor quantization via pipeline masking, while DeepGEMM's Blockwise version shows a gap at low batch. — [[2026-01-27-腾讯混元ai-infra核心技术重磅开源-推理吞吐提升30]]
