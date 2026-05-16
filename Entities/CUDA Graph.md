---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 4
tier: active
---

# CUDA Graph

CUDA mechanism for recording and replaying a fixed sequence of kernel launches, eliminating per-launch CPU overhead.

## Observations

- Applied as Optimization 5 for MLA decode: during decode, only batch size changes between steps (sequence length is fixed), making the graph capturable; eliminates kernel-launch and operator-dispatch overhead alongside `torch.compile`; expected to provide further speedup on top of matrix absorption + FlashMLA + CUTLASS FP8. — [[2025-06-16-细数deepseek-mla-layer从naive实现开始的5大优化策略]]
- Enabling CUDA Graph for rollout in verl+vLLM (off by default, on by default in verl+SGLang): 17% E2E speedup at Qwen2-7B/response=512; 2× speedup at Qwen3-30B/prompt=2048/response=8192; visible Nsight timeline shows large inter-kernel gaps without CUDA Graph. Potential OOM can be addressed by reducing `cuda_graph_capture_size`. — [[2025-09-04-nvidia技术沙龙-强化学习流水线优化-性能分析与-rollout加速-演讲笔]]
