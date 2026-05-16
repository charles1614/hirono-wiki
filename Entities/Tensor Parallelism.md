---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 10
tier: active
---

# Tensor Parallelism

A model parallelism strategy that shards individual weight matrices across multiple GPUs, abbreviated TP.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[vLLM]] V1在TP推理中，`_get_all_weights` 向每个ModelRunner传递完整不切片的权重tensor，各ModelRunner在 `model.load_weights()` 中自行按TP rank切取所需分片；`_initialize_model` 步骤建立每张卡上的模型架构分片（pipeline/tensor维度），量化配置在此阶段注入。 — [[2025-05-27-图解vllm-v1系列4-加载模型权重-load_model]]
- TP is suboptimal for models with very few KV heads: `QKVParallelLinear` replicates each KV head `tp_size / total_num_kv_heads` times when `tp_size ≥ total_num_kv_heads`; for [[MLA]] (`num_kv_heads=1`), TP on 8 GPUs creates 8× KV cache duplication. [[DP Attention]] is preferred in this case. — [[2025-05-27-sglang-dp-attention-介绍]]
- verl source-code primer: TP/PP cut weight tensor W (each rank holds partial W, computes on full activation X), unlike ZeRO-3 which all-gathers complete W then computes on partial X; TP column-parallel linear output requires all-reduce to reconstruct full result, row-parallel linear output does not. — [[2025-05-27-从零开始的verl框架解析]]
