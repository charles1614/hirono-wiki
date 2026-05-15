---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# HPC-Ops

Tencent Hunyuan's open-source high-performance LLM inference operator library (CUDA/CuTe)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Production results: 30% QPM improvement on Tencent Hunyuan models, 17% on [[DeepSeek]] models. Single-operator benchmarks vs. SOTA: Attention decode BF16 1.35×–2.22× over FlashInfer/FlashAttention; Attention decode FP8 1.09×–2.0×; GroupGEMM up to 1.88× over [[DeepGEMM]] v2.2.0 at batch≤64; FusedMoE up to 1.49× over [[TensorRT-LLM]] v1.1.0 in TP mode. GitHub: github.com/Tencent/hpc-ops. — [[2026-01-27-腾讯混元ai-infra核心技术重磅开源-推理吞吐提升30]]
