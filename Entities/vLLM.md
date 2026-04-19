---
created: 2026-04-20T00:00:00.000Z
updated: '2026-04-19'
type: entity
refs: 5
tier: active
---

# vLLM

Open-source LLM inference engine. Originally GPU-centric (paged attention with virtual-memory-style KV cache paging); now expanding to TPUs via [[Google]]-contributed kernels and to [[Trainium3]] via [[AWS]]-internal forks ([[Bedrock]]'s private vLLM v1).

## Synthesis

Thin (2 sources). Cross-vendor inference workhorse — the integration target both [[AWS]] and [[Google]] are racing to support. Its KV-cache paging design is GPU-native and required a different (pipelining-based) rewrite for [[TPU]].

## Observations

- [[AWS]]'s [[Bedrock]] runs DeepSeek/Qwen/etc. on a private fork of vLLM v1, optimized for [[Trainium3]] perf/TCO. — [[2026-04-19-aws-trainium3-deep-dive]]
- [[Google]] has open-sourced and merged TPU-optimized kernels into vLLM: paged attention, compute/comms-overlapped GEMM, quantized matmul. — [[2026-04-20-google-tpuv7-deep-dive]]
- TPU paged attention requires architectural rewrite ("Ragged Paged Attention v3") — TPUs don't support the scatter ops that vLLM's standard GPU paging assumes. — [[2026-04-20-google-tpuv7-deep-dive]]
- Inductor → [[Pallas]] codegen, when mature, may enable kernel fusion + pattern matching inside vLLM's PassManager. — [[2026-04-20-google-tpuv7-deep-dive]]
