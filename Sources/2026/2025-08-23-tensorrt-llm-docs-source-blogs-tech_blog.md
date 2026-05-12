---
created: 2026-05-11
updated: 2026-05-11
type: source
source_url: https://github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/blogs/tech_blog/blog9_Deploying_GPT_OSS_on_TRTLLM.md
tags: [inference, moe, gpu, production-deployment]
---

# [2025-08-23] Running a High-Performance GPT-OSS-120B Inference Server with TensorRT-LLM

## TL;DR

NVIDIA's official deployment guide for serving **gpt-oss-120b** on [[TensorRT-LLM]] across B200/GB200/H200 hardware, split into two operating modes: **low-latency** (max tps/user) vs **max-throughput** (max tps/gpu). Concrete headline numbers: **420 tps/user** at low-latency (8× B200, batch 1); **>20k tps/gpu** max-throughput (4× GB200 with DP4EP4), translating to **>1.5M tps on a GB200 NVL72** system. The two modes are configuration-driven (single YAML diff: `enable_attention_dp` flip + MoE backend swap) and use the same `trtllm-serve` binary.

## Key claims

- **Two modes, one stack.** Low-latency optimizes tps/user (user experience); max-throughput optimizes tps/gpu (economic efficiency). The same `trtllm-serve` binary handles both — what differs is the `--config` YAML.
- **Mode-defining config diff** is small:
  - low-latency: `enable_attention_dp: false`, `moe_config.backend: TRTLLM` (B200/GB200) or `TRITON` (H200), enable PDL via `TRTLLM_ENABLE_PDL=1`.
  - max-throughput: `enable_attention_dp: true`, `moe_config.backend: CUTLASS`, `stream_interval: 10` (amortizes detokenization overhead at high concurrency).
- **CUTLASS MoE backend supports only pure EP** (no mixed TP/EP). So max-throughput sets `--ep ${num_gpus}`. The low-latency TRTLLM backend supports mixed TP/EP, with the recommendation to keep EP small (avoid MoE load imbalance).
- **Attention DP** is the key knob between modes: off at low concurrency, on at high concurrency. When on, `max_batch_size` becomes per-rank (so saturating the system requires `--concurrency = max_batch_size × num_gpus`).
- **Benchmarked best-case numbers** (gpt-oss-120b, ISL=1k, OSL=2k):
  - **Low-latency**: 420 tps/user on 8× B200, batch size 1.
  - **Max-throughput**: 19.5k tps/gpu on 4× B200 (DP4EP4); >20k tps/gpu on GB200; system-level: >1.5M tps on a GB200 NVL72.
  - "Communication implementation for >4 GPUs is suboptimal" — the team is actively improving this, implying current numbers are not the ceiling.
- **H200 quirk**: the OpenAI-shipped Triton MoE kernels are optimized for the H200 — the TRTLLM MoE backend is *not* supported on Hopper. So on H200 the only path is `backend: TRITON`. CUTLASS support on Hopper is "still ongoing." The NGC container already ships the Triton kernels.
- **Container is canonical**: `nvcr.io/nvidia/tensorrt-llm/release:1.1.0rc1`. Multi-platform (x64 + arm64). Mounts `~/.cache` to avoid re-downloading model weights.
- **trtllm-bench → trtllm-serve translation** is mechanical: benchmark commands map 1:1 to serve commands (same `--tp`, `--ep`, `--max_batch_size`, `--config`).
- **Operator gotchas** the post calls out: OOM → reduce `--max_batch_size` / `--max_num_tokens` / `--kv_cache_free_gpu_memory_fraction` (default 0.9); per-iteration debug via `print_iter_log: true` in extra-LLM-API YAML; container startup failure → check NVIDIA Container Toolkit; port 8000 conflicts → `--port` override.

## Visual observations

*No load-bearing images — source has no images.*

This is a github docs markdown page (`docs/source/blogs/tech_blog/blog9_...md`) — pure text content. No figures, charts, or screenshots; YAML configs and tabular benchmark numbers are inlined in the prose and already extracted into Key claims.

## What this changes

- For someone evaluating Blackwell economics: the **20k tps/gpu × 72 GPUs ≈ 1.5M tps/system** is the headline GB200 NVL72 inference number for a frontier MoE OSS model. Concrete benchmark to cite when comparing accelerator-class economics (cf. [[2026-01-15-benchmarking-and-dissecting-the-nvidia-h]] for H100 baseline).
- For an operator deploying gpt-oss-120b: the YAML diff between modes is the working knowledge — there isn't a separate "throughput build."
- The CUTLASS-pure-EP constraint is a real architectural choice — it explains why max-throughput uses pure EP rather than the more flexible mixed TP/EP that low-latency uses.

## Entities touched

[[TensorRT-LLM]], [[GPT-OSS]], [[CUTLASS]], [[OpenAI Triton]], [[Blackwell]], [[Hopper]], [[NVIDIA]]

## Topics touched

[[LLM Inference Systems]], [[MoE Serving]], [[Accelerator Economics]]

## Raw source

[github.com/NVIDIA/TensorRT-LLM/.../blog9_Deploying_GPT_OSS_on_TRTLLM.md](https://github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/blogs/tech_blog/blog9_Deploying_GPT_OSS_on_TRTLLM.md) — ~9 KB markdown, prose how-to with embedded YAML/bash recipes. Read 2026-05-11.
