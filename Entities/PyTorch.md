---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 16
tier: active
---

# PyTorch

Dominant ML framework for research and production; graph compilation via torch.compile; Meta-maintained.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Ships a first-party GPU memory profiler (`torch.cuda.memory._record_memory_history` + `_dump_snapshot`) that records all allocation events and exports a `.pkl` file visualizable at pytorch.org/memory_viz — useful for identifying which of the five training-loop memory zones is causing OOM. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
- Layered architecture spans Python API (torch.Tensor, torch.nn, torch.optim), Compiler Stack ([[Torch Compile]]/Dynamo → FX → AOT Autograd → Inductor), and C++ Core (autograd → ATen → c10); the `c10` library holds fundamental abstractions including TensorImpl, Storage, and DispatchKey; Inductor generates Triton or C++ kernels. — [[2026-01-22-deepwiki-pytorch-02-core-tensor-library]]
- PyTorch Conference 2025 featured 117 videos total; [[vLLM]] appeared in ~45% of sessions, [[Ray]] featured in keynote #4 as "A Distributed Compute Engine for AI", and [[SGLang]] had dedicated sessions on MoE/RL optimization. The conference scope spans serving, training, post-training, agents, hardware accelerators, and embodied intelligence. — [[2025-12-14-vllm-project-vllm-in-pytorch-conference-]]
- Non-contiguous tensor从torch.chunk产生后，若后续无强制contiguous的kernel调用则保持该属性，导致下游的cat kernel选用非对齐内存模板而显著变慢（示例：两个contiguous的txt/img key各62us，而value因非contiguous导致cat kernel 155us）；诊断方法：打印tensor的`.is_contiguous()`并用Nsight Systems对比两端kernel时间线。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
