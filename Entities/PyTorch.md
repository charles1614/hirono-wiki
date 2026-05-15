---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 11
tier: active
---

# PyTorch

Dominant ML framework for research and production; graph compilation via torch.compile; Meta-maintained.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Ships a first-party GPU memory profiler (`torch.cuda.memory._record_memory_history` + `_dump_snapshot`) that records all allocation events and exports a `.pkl` file visualizable at pytorch.org/memory_viz — useful for identifying which of the five training-loop memory zones is causing OOM. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
- Layered architecture spans Python API (torch.Tensor, torch.nn, torch.optim), Compiler Stack ([[Torch Compile]]/Dynamo → FX → AOT Autograd → Inductor), and C++ Core (autograd → ATen → c10); the `c10` library holds fundamental abstractions including TensorImpl, Storage, and DispatchKey; Inductor generates Triton or C++ kernels. — [[2026-01-22-deepwiki-pytorch-02-core-tensor-library]]
