---
created: 2026-05-12
updated: 2026-05-17
type: entity
refs: 10
tier: active
---

# Torch Compile

PyTorch 2.x's compilation path that fuses operators and emits optimized kernels (Inductor backend).

## Observations

- Edward Yang（PyTorch 编译器团队）2025-08 总结：`torch.compile` 较 Eager 通常带来 1.5–2× 加速；关键非功能性特性包括 JIT（首次调用阻塞编译）、图中断透明绕过、函数调用默认内联（编译时间与 Transformer block 数量成正比，可用 regional compilation 优化）；当前大规模训练推荐路径为 fork [[Torchtitan]] 作为训练栈基础。 — [[2025-09-04-torch-compile-训练的现状总结-2025年8月]]
- [[vLLM]] uses `torch.compile` infrastructure (not hand-coded fusion) to automatically fuse AllReduce+RMSNorm and Pad+Quant+Finalize+Slice operations for `gpt-oss-120b` on Blackwell; the Pad+Quant fusion (PR30647) is projected to deliver 6% additional speedup; approach reduces engineering overhead compared to maintaining per-op hand-coded kernels. — [[2026-02-04-gpt-oss-在-nvidia-blackwell-上的性能优化-推动-par]]
- 2026 momentum on torch.compile: TorchTitan RL 6× speedup; Diffusers Flux-1-Dev 1.5× with `compile_repeated_blocks` cutting compile latency 7×; nested graph breaks default-on candidate (graph-break reductions up to 67%, 15% runtime speedup in GNNs/detection); Dynamo CPython-semantics refactor lifting test pass 38%→45%; graph-break-free print/inspect toolkit for forward activations and backward gradients. — [[2026-05-12-pytorch-devlog]]
