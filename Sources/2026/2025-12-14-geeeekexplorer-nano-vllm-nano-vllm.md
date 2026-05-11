---
created: 2026-05-11
updated: 2026-05-11
type: source
raw_source: https://github.com/GeeeekExplorer/nano-vllm
tags: [vllm, education, minimal-impl, readable-code, qwen, inference]
---

# [2025-12-14] Nano-vLLM — A Lightweight vLLM Implementation Built From Scratch

## TL;DR

**~1,200 lines of Python** re-implementing the core of [[vLLM]] from scratch — paged-attention, prefix caching, tensor parallelism, Torch compilation, CUDA graphs. **Matches or slightly beats** vLLM's throughput on a laptop-class benchmark (Qwen3-0.6B on RTX 4070 Laptop 8GB, 256 sequences): 1434 vs 1361 tok/s, 93.4s vs 98.4s. Repo positioned as a **readable codebase for learning** — the API mirrors vLLM closely (`LLM`, `SamplingParams`, `llm.generate(prompts, sampling_params)`) so anyone curious about how vLLM works internally can read this one instead of vLLM's much larger codebase.

## Key claims

- **Scope discipline**: ~1,200 LoC. The whole *point* is to be small enough to read end-to-end in an afternoon. Anyone trying to understand the paged-attention/scheduler/KV-cache loop should start here, not in vLLM's `vllm/v1/` tree.
- **Feature parity for the core**:
  - Paged attention (the load-bearing vLLM mechanism).
  - **Prefix caching**.
  - **Tensor parallelism**.
  - **Torch compile + CUDA graphs**.
  - These are the four headline performance levers in real vLLM — and they all fit in 1.2K lines when you strip the production scaffolding.
- **Benchmark on RTX 4070 Laptop (8GB)**, Qwen3-0.6B, 256 sequences (ISL 100-1024, OSL 100-1024):
  - vLLM: 1361.84 tok/s in 98.37s.
  - **Nano-vLLM: 1434.13 tok/s in 93.41s (~5% faster)**.
  - Same output token counts (133,966). Apples-to-apples.
- **API surface mirrors vLLM**:
  ```python
  from nanovllm import LLM, SamplingParams
  llm = LLM("/YOUR/MODEL/PATH", enforce_eager=True, tensor_parallel_size=1)
  sampling_params = SamplingParams(temperature=0.6, max_tokens=256)
  outputs = llm.generate(prompts, sampling_params)
  ```
  Only difference: `llm.generate` returns dicts (`outputs[0]["text"]`) instead of vLLM's `RequestOutput` objects.
- **Installation**: pip-installable directly from the GitHub repo (`pip install git+https://github.com/GeeeekExplorer/nano-vllm.git`). No PyPI publication, no Docker.
- **The benchmark caveat**: 0.6B model on a laptop GPU is a narrow regime. Production vLLM's optimizations (chunked prefill, speculative decoding, scheduler refinements, NIXL connector, etc.) are designed for 70B+ on H100/B200 clusters where the throughput-vs-latency tradeoff space is much richer. Nano-vLLM doesn't claim to win there — it claims to *teach* the core, and to be unexpectedly close in throughput at small scale.

## Entities touched

[[vLLM]], [[Qwen]], [[PagedAttention]], [[Torch Compile]], [[CUDA Graph]]

## Topics touched

[[LLM Inference Systems]], [[Educational LLM Tooling]]

## Raw source

[github.com/GeeeekExplorer/nano-vllm](https://github.com/GeeeekExplorer/nano-vllm) — ~2 KB README + small Python codebase. Star history image. Inspired by trendshift attention. Read 2026-05-11.
