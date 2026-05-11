---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/GeeeekExplorer/nano-vllm
tags: [vllm, inference, education, minimal-implementation]
---

# [2025-12-14] GeeeekExplorer/nano-vllm — Nano-vLLM

## TL;DR

A from-scratch reimplementation of [[vLLM]] in ~1,200 lines of Python — a readable, single-author distillation of the production vLLM stack. Hits **comparable throughput** to upstream vLLM (1434 vs 1362 tok/s on Qwen3-0.6B at RTX 4070), with the same optimization suite: prefix caching, tensor parallelism, `torch.compile`, CUDA graph. nanoGPT-shaped artifact for the inference-stack literacy gap.

## Key claims

- The full optimization surface — prefix caching, tensor parallelism, `torch.compile`, CUDA graph — fits in ~1,200 lines of Python when stripped of vLLM's full feature matrix. Implication: the inference stack is conceptually smaller than its codebase suggests.
- Performance is **not the trade-off**: nano-vLLM is ~5% *faster* than upstream vLLM on the cited benchmark (1434 vs 1362 tok/s on Qwen3-0.6B at RTX 4070, 256 reqs, in/out len 100–1024). Small-model + small-GPU regime — narrows the gap that mature optimization closes at scale.
- API mirrors vLLM's surface (`LLM.generate`, `SamplingParams`) — drop-in replaceable for experimentation; production users wouldn't migrate.
- Hardware tested: consumer GPU (RTX 4070 Laptop, 8 GB) — explicitly readable-codebase + consumer-hardware framing. Counter-positions vLLM's "enterprise / datacenter / H100" framing.
- Trendshift-listed; star history visible. Educational-artifact category, alongside [[nanoGPT]], [[llm.c]], [[picoGPT]].

## Entities touched

[[vLLM]], [[nanoGPT]], [[Qwen]], [[PyTorch]], [[CUDA]]

## Topics touched

[[LLM Inference Systems]], [[Minimal-Implementation Pedagogy]]

## Open questions

- Throughput parity at small model + small batch is plausible; at H100 + Llama-70B + thousands-of-concurrent-reqs, vLLM's continuous batching + paged attention + complex scheduler should dominate. What's the operating regime where nano-vLLM stops being competitive?
- "Prefix caching" implementation — copied from vLLM's PagedAttention or a simpler key-by-prefix-hash variant? The line count suggests the latter.
- The 5%-faster result on the small workload — is this measurement noise, simpler code path winning by skipping overhead, or actual algorithmic win?
- Does nano-vLLM support speculative decoding? The "Key Features" list doesn't mention it; if not, the 1,200-LOC scope excludes one of the highest-impact inference optimizations.
- Pedagogical question: is nano-vLLM the right read to *learn* the vLLM stack, or do you still need to read upstream's PagedAttention paper + scheduler code to actually understand it?

## Raw source

[github.com/GeeeekExplorer/nano-vllm](https://github.com/GeeeekExplorer/nano-vllm) — README only (~2 KB body), full code under `nanovllm/`.
