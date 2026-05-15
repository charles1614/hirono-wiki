---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 23
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
- [[MMCV]] `mmcv/parallel/_functions.py` needed a version guard: `_get_stream` changed signature in PyTorch 2.1.0 from accepting a raw int device index to requiring a `torch.device("cuda", device)` object; [[FSDP]] scatter path is affected. — [[2025-08-09-bugfix-get_stream-harboryuan-mmcv_16-ad1]]

- PyTorch 2.1 enhanced memory snapshot API (`_record_memory_history` + `_dump_snapshot`): records per-tensor allocation events with Python/C++ call stacks, exports a `.pkl` file for pytorch.org/memory_viz; three views: Active Memory Timeline, Allocator State History (torch-allocator block/segment lifecycle — `block.free` ≠ `cudaFree`), and Active Cached Segment Timeline. Snapshot overhead is high; disable in production. — [[2025-11-12-pytorch显存可视化与snapshot数据分析]]
- Memory snapshot 实战解读（AMP 混合精度训练）：forward 阶段 `autocast()` 上下文内 FP32 权重转 FP16，FP32 主权重保留；backward 阶段 `GradScaler.scale(loss).backward()` 累积 FP16 梯度，`scaler.step()` 更新前还原 FP32；每个步骤下的 segment 分配/复用/释放均可在 memory snapshot 堆栈信息中追溯到 Python 源码行号，侧重"如何解读记录内容"而非操作步骤。 — [[2025-09-22-如何利用pytorch-memory-snapshot进行显存分析]]
- In verl's Nsight integration, `torch.cuda.profiler.start()` / `torch.cuda.profiler.stop()` are used to control Nsight capture-range activation per training step, enabling targeted profiling of specific steps within a long training run. This is the standard PyTorch interface to Nsight's capture-range mechanism for RL training frameworks. — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
