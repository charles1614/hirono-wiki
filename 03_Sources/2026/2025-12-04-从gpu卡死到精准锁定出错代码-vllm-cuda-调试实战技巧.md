---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://mp.weixin.qq.com/s/VHFnA9nkasOJ-svIFp7IXQ
tags: [inference, observability, gpu, production-deployment]
---

# [2025-12-04] 从GPU卡死到精准锁定出错代码：vLLM CUDA 调试实战技巧

## TL;DR

vLLM engineering blog post describing two CUDA debugging techniques: (1) user-triggered GPU core dumps via CUDA driver pipe to identify hung kernels, and (2) combining `NVCC_PREPEND_FLAGS=-lineinfo` + `cuda-gdb` + `nvdisasm` to extract the full inline call chain from a complex kernel, beyond what `cuda-gdb` alone shows.

## Key claims

- A GPU kernel hang makes `Ctrl-C` ineffective because Python's `KeyboardInterrupt` cannot fire while the process is blocking on a CUDA API call; the fix is `signal.signal(signal.SIGINT, signal.SIG_DFL)` or using CUDA core dumps instead.
- CUDA driver supports user-induced GPU core dumps via a named pipe (`CUDA_ENABLE_USER_TRIGGERED_COREDUMP=1`, `CUDA_COREDUMP_PIPE`); triggering by writing 1 MB of zeros to the pipe captures the hung kernel identity and approximate source location.
- The pipe path is dynamic but discoverable via `/proc/<pid>/fd/` — useful for production runbooks.
- `cuda-gdb` alone only shows the last inline frame; for deep CUTLASS or kernel-library stacks, `nvdisasm -ndf -c -gi` on the cubin extracted by `cuda-gdb` reveals the full multi-level inline chain (e.g., 8+ levels in FlashAttention-style kernels).
- This technique located a CUTLASS MLA attention hang in vLLM (PR #26026), whose root cause traced to an upstream CUTLASS example code bug fixed in CUTLASS v4.3.0.
- `ccache` may silently re-use binaries compiled without `-lineinfo`; verify line numbers are present before debugging.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

Provides a reproducible 2-step CUDA debug workflow (core dump + nvdisasm inline chain) for LLM inference engineers dealing with GPU hangs or illegal memory access — concrete enough to add to internal runbooks.

## Entities touched

[[vLLM]], [[CUDA]], [[CUTLASS]], [[OpenAI Triton]]

## Topics touched

[[GPU Profiling]]

## Raw source

[mp.weixin.qq.com/s/VHFnA9nkasOJ-svIFp7IXQ](https://mp.weixin.qq.com/s/VHFnA9nkasOJ-svIFp7IXQ) — vLLM official WeChat blog; translation of https://blog.vllm.ai/2025/12/03/improved-cuda-debugging.html; published 2025-12-04. Read 2026-05-15.
