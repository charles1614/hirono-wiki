---
created: 2026-05-12
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 10
tier: active
---

# Tensor Parallelism

A model parallelism strategy that shards individual weight matrices across multiple GPUs, abbreviated TP.

## Synthesis



Tensor Parallelism shards weight matrices across GPUs so each rank computes on full activations with partial weights — distinct from ZeRO-3 which all-gathers complete weights then computes on partial activations — with column-parallel linear requiring AllReduce to reconstruct full output and row-parallel linear not requiring it. In vLLM V1's load path, `_get_all_weights` passes each ModelRunner the full unsliced weight tensor and each TP rank slices its own portion inside `model.load_weights()`, with `_initialize_model` injecting quantization configuration at the same stage. TP is suboptimal for models with very few KV heads: `QKVParallelLinear` replicates each KV head `tp_size / total_num_kv_heads` times when `tp_size ≥ total_num_kv_heads`, so for MLA (`num_kv_heads=1`) TP on 8 GPUs creates 8× KV cache duplication — DP Attention is preferred in that case, sharding requests rather than KV heads. Limited corpus evidence beyond these implementation-level mechanics; the broader role of TP as the dominant intra-node parallelism axis is documented in adjacent entities (Megatron-LM, NVLink, Expert Parallelism) rather than directly here.



## Observations

- [[vLLM]] V1在TP推理中，`_get_all_weights` 向每个ModelRunner传递完整不切片的权重tensor，各ModelRunner在 `model.load_weights()` 中自行按TP rank切取所需分片；`_initialize_model` 步骤建立每张卡上的模型架构分片（pipeline/tensor维度），量化配置在此阶段注入。 — [[2025-05-27-图解vllm-v1系列4-加载模型权重-load_model]]
- TP is suboptimal for models with very few KV heads: `QKVParallelLinear` replicates each KV head `tp_size / total_num_kv_heads` times when `tp_size ≥ total_num_kv_heads`; for [[MLA]] (`num_kv_heads=1`), TP on 8 GPUs creates 8× KV cache duplication. [[DP Attention]] is preferred in this case. — [[2025-05-27-sglang-dp-attention-介绍]]
- verl source-code primer: TP/PP cut weight tensor W (each rank holds partial W, computes on full activation X), unlike ZeRO-3 which all-gathers complete W then computes on partial X; TP column-parallel linear output requires all-reduce to reconstruct full result, row-parallel linear output does not. — [[2025-05-27-从零开始的verl框架解析]]
