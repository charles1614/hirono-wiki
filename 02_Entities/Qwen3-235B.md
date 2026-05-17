---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# Qwen3-235B

Alibaba's Qwen3 235B parameter MoE model

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- In a casual community code-generation shootout (linux.do, 2025-05-28), [[Qwen3-235B]] (both thinking and non-thinking modes) was rated poorly for HTML/CSS animation quality — described as "CSS 写错了" style — compared to [[DeepSeek-R1]] (R1-0528) and Doubao; a follow-up test with Qwen3's web deep-thinking mode showed moderate improvement. — [[2025-05-28-685482]]
- FP8+TP4 online serving throughput per device: 901.2 tok/s output tokens, 4.25 req/s; BF16+TP8: 515.2 tok/s, 2.56 req/s. FP8 offline batch (BS=128, in=1024, out=128): 340.7 tok/s per device vs BF16 226.1 tok/s per device (~1.5×). — [[2025-05-26-基于vllm-v1测试bfloat16-vs-fp8-qwen3-moe模型吞吐]]
