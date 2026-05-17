---
created: 2026-05-11
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 32
tier: active
---

# PyTorch

Dominant ML framework for research and production; graph compilation via torch.compile; Meta-maintained.

## Synthesis





PyTorch is the dominant deep learning framework for LLM training and inference, with a layered architecture spanning the Python API (torch.Tensor, torch.nn, torch.optim), the Compiler Stack (TorchDynamo → FX → AOT Autograd → Inductor generating Triton or C++ kernels), and the C++ Core (autograd → ATen → c10, where TensorImpl, Storage, and DispatchKey live). Its first-party memory profiler (`torch.cuda.memory._record_memory_history` + `_dump_snapshot`) records per-tensor allocation events with Python/C++ call stacks and exports a `.pkl` for the memory_viz visualizer, supporting Active Memory Timeline, Allocator State History (where `block.free` ≠ `cudaFree` because the torch allocator caches segments until `empty_cache()`), and Active Cached Segment Timeline views. A practical performance hazard is non-contiguous tensors from `torch.chunk`: downstream `cat` kernels select non-aligned memory templates, causing ~2.5× latency regression (155 µs vs 62 µs in documented cases) that is invisible without Nsight kernel-level comparison. PyTorch Conference 2025 had vLLM mentioned in ~45% of 117 sessions, Ray in the #4 keynote as "A Distributed Compute Engine for AI," and SGLang in dedicated MoE/RL sessions — signaling PyTorch's role as the ecosystem lingua franca. PyTorch and OpenAI Triton share a CUDA Runtime interface layer: Triton's `GPUDriver` reuses `torch.cuda.set_device` and related APIs, and `torch._C` provides the `cudaLaunchKernel` path for both frameworks under lazy CUDA-context initialization.





## Observations

- Ships a first-party GPU memory profiler (`torch.cuda.memory._record_memory_history` + `_dump_snapshot`) that records all allocation events and exports a `.pkl` file visualizable at pytorch.org/memory_viz — useful for identifying which of the five training-loop memory zones is causing OOM. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
- Layered architecture spans Python API (torch.Tensor, torch.nn, torch.optim), Compiler Stack ([[Torch Compile]]/Dynamo → FX → AOT Autograd → Inductor), and C++ Core (autograd → ATen → c10); the `c10` library holds fundamental abstractions including TensorImpl, Storage, and DispatchKey; Inductor generates Triton or C++ kernels. — [[2026-01-22-deepwiki-pytorch-02-core-tensor-library]]
- PyTorch Conference 2025 featured 117 videos total; [[vLLM]] appeared in ~45% of sessions, [[Ray]] featured in keynote #4 as "A Distributed Compute Engine for AI", and [[SGLang]] had dedicated sessions on MoE/RL optimization. The conference scope spans serving, training, post-training, agents, hardware accelerators, and embodied intelligence. — [[2025-12-14-vllm-project-vllm-in-pytorch-conference-]]
- Non-contiguous tensor从torch.chunk产生后，若后续无强制contiguous的kernel调用则保持该属性，导致下游的cat kernel选用非对齐内存模板而显著变慢（示例：两个contiguous的txt/img key各62us，而value因非contiguous导致cat kernel 155us）；诊断方法：打印tensor的`.is_contiguous()`并用Nsight Systems对比两端kernel时间线。 — [[2025-12-25-如何系统性定位并分析-pytorch-模型推理中的性能瓶颈]]
- [[MMCV]] `mmcv/parallel/_functions.py` needed a version guard: `_get_stream` changed signature in PyTorch 2.1.0 from accepting a raw int device index to requiring a `torch.device("cuda", device)` object; [[FSDP]] scatter path is affected. — [[2025-08-09-bugfix-get_stream-harboryuan-mmcv_16-ad1]]

- PyTorch 2.1 enhanced memory snapshot API (`_record_memory_history` + `_dump_snapshot`): records per-tensor allocation events with Python/C++ call stacks, exports a `.pkl` file for pytorch.org/memory_viz; three views: Active Memory Timeline, Allocator State History (torch-allocator block/segment lifecycle — `block.free` ≠ `cudaFree`), and Active Cached Segment Timeline. Snapshot overhead is high; disable in production. — [[2025-11-12-pytorch显存可视化与snapshot数据分析]]
- Memory snapshot 实战解读（AMP 混合精度训练）：forward 阶段 `autocast()` 上下文内 FP32 权重转 FP16，FP32 主权重保留；backward 阶段 `GradScaler.scale(loss).backward()` 累积 FP16 梯度，`scaler.step()` 更新前还原 FP32；每个步骤下的 segment 分配/复用/释放均可在 memory snapshot 堆栈信息中追溯到 Python 源码行号，侧重"如何解读记录内容"而非操作步骤。 — [[2025-09-22-如何利用pytorch-memory-snapshot进行显存分析]]
- In verl's Nsight integration, `torch.cuda.profiler.start()` / `torch.cuda.profiler.stop()` are used to control Nsight capture-range activation per training step, enabling targeted profiling of specific steps within a long training run. This is the standard PyTorch interface to Nsight's capture-range mechanism for RL training frameworks. — [[2025-07-23-https-zhuanlan-zhihu-com-p-1929264741248]]
- [[PyTorch]] 通过 `torch._C` 扩展模块调用 CUDA Runtime API，采用延迟初始化（`_lazy_init`）；[[OpenAI Triton]] 的 `GPUDriver` 复用PyTorch CUDA API（`torch.cuda.set_device`等）进行设备管理，两者在完整推理流程中共享同一CUDA Runtime接口层。 — [[2025-05-27-pytorch-triton与runtime的三角虐恋]]
- [[vLLM]] V1的 `load_model` 调用链（Executor→Worker→ModelRunner→DefaultModelLoader）中，`_get_all_weights` 生成不预切片的完整权重迭代器，每个TP rank的ModelRunner在 `model.load_weights()` 时自行切取所需分片；RLHF场景下Actor权重更新可直接构建为此格式的迭代器传入 `model_runner.model.load_weights()`。 — [[2025-05-27-图解vllm-v1系列4-加载模型权重-load_model]]
