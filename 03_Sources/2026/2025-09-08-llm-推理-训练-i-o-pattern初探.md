---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://zhuanlan.zhihu.com/p/717560804
tags: [inference, training, observability, data-loading, microbenchmark]
---

# [2024-08-31] LLM 推理/训练 I/O Pattern初探

## TL;DR

An empirical study using strace (syscall trace) and blktrace (block-device trace) to characterize the storage I/O patterns of LLM inference and fine-tuning workloads, finding that inference uses mmap-based file mapping (no blocking reads) while training uses random read + writev, and that I/O request sizes cluster around 4KB/128KB/256KB for inference and 4KB/128KB/512KB for training.

## Key claims

- LLM inference (vLLM-style) accesses model files exclusively via mmap with MAP_ANONYMOUS, not blocking `read`/`pread` or async I/O; each mmap/munmap pair for a model shard closes within ~1.97ms, suggesting DMA or driver-level transfers rather than CPU-mediated reads.
- Inference blktrace shows 86.2% random read by I/O count (87.0% by byte volume) and 83.3% of block requests are 256KB; total read volume ~12.9GB for a single inference run.
- LLM training (ChatGLM2-6B fine-tuning via PT method) loads model files using `lseek+read` (random seeks, not sequential), contrary to naive expectation; model is located via `getdents64` traversal of HuggingFace cache snapshot directories.
- Training blktrace: 93.2% sequential read by byte volume (25.98% of trace count); 91.5% sequential write by byte volume; total read ~12.5GB, write ~23.8GB (2× read volume matches 2 training epochs × checkpoint saves).
- Write I/O pattern uses `writev` to write safetensor checkpoint files (`pytorch_model-00001-of-00002.bin` etc.); writer size dominates at 512KB (90.36% of write bytes).
- Author hypothesis: random load-time reads are driven by PyTorch's safetensor index file (`pytorch_model.bin.index.json`) which encodes byte-offset mappings; understanding this index is a key next step.

## Visual observations

![](https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-09-08-llm-推理-训练-i-o-pattern初探/zhihu-img-001.jpg)
![](https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-09-08-llm-推理-训练-i-o-pattern初探/zhihu-img-002.jpg)
![](https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-09-08-llm-推理-训练-i-o-pattern初探/zhihu-img-004.jpg)

*Other images: write and training I/O histograms — patterns described verbatim in body text above.*

## Entities touched

[[vLLM]]

## Topics touched

[[Data Loading Pipelines]], [[GPU Profiling]], [[LLM Inference Systems]], [[LLM Training Systems]]

## Raw source

[zhuanlan.zhihu.com/p/717560804](https://zhuanlan.zhihu.com/p/717560804) — Zhihu article by TimeSea, published 2024-08-31. Read 2026-05-16.
