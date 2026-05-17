---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/vllm-project/vllm/pull/6496
tags: [inference, kv-cache, gpu]
---

# [2024-07-18] vLLM PR #6496: CPU Offload via Pipeline Parallel Hook

## TL;DR

youkaichao 实现了 vLLM 的 CPU offload 方案（PR #6496，已合并至 main），通过 hook pipeline parallel 的 `make_layers` 函数按需将层权重搬移到 GPU，实现对用户透明的显存扩展，兼容 CUDA graph 和异步拷贝。

## youkaichao

> opened this on Jul 17, 2024 · Member

## Key claims

- 实现思路：hook `make_layers`（pipeline parallel 入口），使部分 layer 在推理时按需从 CPU pinned memory 加载到 GPU，通过 `torch.func.functional_call` 替换 state dict，对模型其余功能透明。
- `--cpu-offload-gb` 参数语义直观：表示每块 GPU 额外可用的 CPU 内存 GB 数，例如 24 GB GPU + `--cpu-offload-gb 10` = 虚拟 34 GB GPU；可加载约 26 GB 的 13B BF16 模型。
- 兼容 CUDA graph（pinned memory 在 cudagraph 中也正常工作）和非阻塞异步拷贝（`non_blocking=True`），无需 eager 模式。
- GH200 实测（Meta-Llama-3-70B-Instruct，`--cpu-offload-gb 70`）：模型加载 61.29 GB，加载时间约 8 分钟（vs. PR #6317 的 4 分 20 秒），TTFT 与非 offload 相当；吞吐略低于 PR #6317（~4.1 t/s）。
- 量化模型兼容性待验证（参数 rewrite 发生在权重加载前/中/后，可能与 offload hook 冲突）。
- Diff: +128 / -4 行，7 个文件，侵入性极低。

## Visual observations

*No load-bearing images — source has no images.*

## Entities touched

[[vLLM]]

## Topics touched

[[KV Cache Management]], [[GPU Memory Management]]

## Raw source

[github.com/vllm-project/vllm/pull/6496](https://github.com/vllm-project/vllm/pull/6496) — GitHub Pull Request, youkaichao, merged 2024-07-18. Read 2026-05-16.
