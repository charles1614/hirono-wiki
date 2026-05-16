---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/WENW-CeMmBTlgyTBDLX-1w
tags: [inference, parallelism]
---

# [2025-05-09] 图解vLLM V1系列4：加载模型权重(load_model)

## TL;DR

深入解析[[vLLM]] V1的 `load_model()` 调用链（Executor→Worker→ModelRunner→DefaultModelLoader），重点说明权重迭代器机制、模型架构分片初始化、以及在RLHF场景下Actor权重更新到vLLM推理引擎的实现路径。

## Key claims

- `load_model` 调用链为：`MultiProcExecutor` → `Worker.load_model()` → `ModelRunner.load_model()` → `DefaultModelLoader.load_model()`，默认使用 `DefaultModelLoader`（`LoadFormat.Auto`）。
- 模型架构初始化分两步：首先通过 `config.json` 的 `architectures` 字段找到HF类名，再映射到vLLM重写的Python class（如 `QWenLMHeadModel` → vLLM版），用惰性注册（`_LazyRegisteredModel`）延迟import减少开销。
- 权重加载采用迭代器模式：`_get_all_weights` 生成 `(权重名, tensor)` 迭代器，不预先切片；`model.load_weights()` 遍历时每个ModelRunner按TP/PP配置自行切取所需分片。
- 量化模型（AWQ/GPTQ）在 `_initialize_model` 阶段动态将 `Linear` 替换为 `QuantLinear`，后处理由 `_process_weights_after_loading` 完成。
- RLHF场景权重更新建议：将Actor完整权重（去切片）构建为与 `_get_all_weights` 相同格式的迭代器，直接传入 `model_runner.model.load_weights()`，每个TP rank接收完整权重后自行切分。

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[vLLM]], [[PyTorch]], [[Tensor Parallelism]]

## Topics touched

[[LLM Inference Systems]], [[RL Post-Training]]

## Raw source

[mp.weixin.qq.com/s/WENW-CeMmBTlgyTBDLX-1w](https://mp.weixin.qq.com/s/WENW-CeMmBTlgyTBDLX-1w) — 微信公众号"大猿搬砖简记"，2025-05-09. Read 2026-05-16.
