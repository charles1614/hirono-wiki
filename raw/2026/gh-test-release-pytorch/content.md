# pytorch/pytorch: PyTorch 2.5.0 Release, SDPA CuDNN backend, Flex Attention

> 原文链接: https://github.com/pytorch/pytorch/releases/tag/v2.5.0
> Released by [jainapurva](https://github.com/jainapurva) · Oct 17, 2024 · tag `v2.5.0`

---

# PyTorch 2.5 Release Notes

- Highlights  
- Backwards Incompatible Change  
- Deprecations  
- New Features  
- Improvements  
- Bug fixes  
- Performance  
- Documentation  
- Developers  
- Security

## Highlights

We are excited to announce the release of PyTorch® 2.5! This release features a new CuDNN backend for SDPA, enabling speedups by default for users of SDPA on H100s or newer GPUs. As well, regional compilation of torch.compile offers a way to reduce the cold start up time for torch.compile by allowing users to compile a repeated nn.Module (e.g. a transformer layer in LLM) without recompilations. Finally, TorchInductor CPP backend offers solid performance speedup with numerous enhancements like FP16 support, CPP wrapper, AOT-Inductor mode, and max-autotune mode.
This release is composed of 4095 commits from 504 contributors since PyTorch 2.4. We want to sincerely thank our dedicated community for your contributions. As always, we encourage you to try these out and report any issues as we improve 2.5. More information about how to get started with the PyTorch 2-series can be found at our [Getting Started](https://pytorch.org/get-started/pytorch-2.0/) page.
As well, please check out our new ecosystem projects releases with [TorchRec](https://github.com/pytorch/torchrec) and [TorchFix](https://github.com/pytorch-labs/torchfix/releases/tag/v0.6.0).

| Beta | Prototype |
|------|-----------|
| CuDNN backend for SDPA | FlexAttention |
| torch.compile regional compilation without recompilations | Compiled Autograd |
| TorchDynamo added support for exception handling & MutableMapping types | Flight Recorder |
| TorchInductor CPU backend optimization | Max-autotune Support on CPU with GEMM Template |
| | TorchInductor on Windows |
| | FP16 support on CPU path for both eager mode and TorchInductor CPP backend |
| | Autoload Device Extension |
| | Enhanced Intel GPU support |

*To see a full list of public feature submissions click [here](https://docs.google.com/spreadsheets/d/1TzGkWuUMF1yTe88adz1dt2mzbIsZLd3PBasy588VWgk/edit?gid=949287277#gid=949287277).

### BETA FEATURES
#### [Beta] CuDNN backend for SDPA
The cuDNN "Fused Flash Attention" backend  was landed for `torch.nn.functional.scaled_dot_product_attention`. On NVIDIA H100 GPUs this can provide up to 75% speed-up over FlashAttentionV2. This speedup is enabled by default for all users of SDPA on H100 or newer GPUs.
#### [Beta] _torch.compile_ regional compilation without recompilations
Regional compilation without recompilations, via `torch._dynamo.config.inline_inbuilt_nn_modules` which default to True in 2.5+. This option allows users to compile a repeated nn.Module (e.g. a transformer layer in LLM) without recompilations. Compared to compiling the full model, this option can result in smaller compilation latencies with 1%-5% performance degradation compared to full model compilation.

See the [tutorial](https://pytorch.org/tutorials/recipes/regional_compilation.html) for more information.
#### [Beta] TorchInductor CPU backend optimization
This feature advances Inductor’s CPU backend optimization, including CPP backend code generation and FX fusions with customized CPU kernels. The Inductor CPU backend supports vectorization of common data types and all Inductor IR operations, along with the static and symbolic shapes. It is compatible with both Linux and Windows OS and supports the default Python wrapper, the CPP wrapper, and AOT-Inductor mode. 

Additionally, it extends the max-autotune mode of the GEMM template (prototyped in 2.5), offering further performance gains. The backend supports various FX fusions, lowering to customized kernels such as oneDNN for Linear/Conv operations and SDPA. The Inductor CPU backend consistently achieves performance speedups across three benchmark suites—TorchBench, Hugging Face, and timms—outperforming eager mode in 97.5% of the 193 models tested.

### PROTOTYPE FEATURES
#### [Prototype] FlexAttention
We've introduced a flexible API that enables implementing various attention mechanisms such as Sliding Window, Causal Mask, and PrefixLM with just a few lines of idiomatic PyTorch code. This API leverages torch.compile to generate a fused FlashAttention kernel, which eliminates extra memory allocation and achieves performance comparable to handwritten implementations. Additionally, we automatically generate the backwards pass using PyTorch's autograd machinery. Furthermore, our API can take advantage of sparsity in the attention mask, resulting in significant improvements over standard attention implementations.

For more information and examples, please refer to the [official blog post](https://pytorch.org/blog/flexattention/) and [Attention Gym](https://github.com/pytorch-labs/attention-gym).
#### [Prototype] Compiled Autograd
Compiled Autograd is an extension to the PT2 stack allowing the capture of the entire backward pass. Unlike the backward graph traced by AOT dispatcher, Compiled Autograd tracing is deferred until backward execution time, which makes it impervious to forward pass graph breaks, and allows it to record backward hooks into the graph.

Please refer to the [tutorial](https://pytorch.org/tutorials/intermediate/compiled_autograd_tutorial.html) for more information.
#### [Prototype] Flight Recorder
Flight recorder is a new debugging tool that helps debug stuck jobs. The tool works by continuously capturing information about collectives as they run. Upon detecting a stuck job, the information can be used to quickly identify misbehaving ranks/machines along with code stack traces.

For more information please refer to the following [tutorial](https://pytorch.org/tutorials/prototype/flight_recorder_tutorial.html).
#### [Prototype] Max-autotune Support on CPU with GEMM Template
Max-autotune mode for the Inductor CPU backend in torch.compile profiles multiple implementations of operations at compile time and selects the best-performing one. This is particularly beneficial for GEMM-related operations, using a C++ template-based GEMM implementation as an alternative to the ATen-based approach with oneDNN and MKL libraries. We support FP32, BF16, FP16, and INT8 with epilogue fusions for x86 CPUs. We’ve seen up to 7% geomean speedup on the dynamo benchmark suites and up to 20% boost in next-token latency for LLM inference.

For more information please refer to the [tutorial](https://pytorch.org/tutorials/prototype/max_autotune_on_CPU_tutorial.html).
#### [Prototype] TorchInductor CPU on Windows
Inductor CPU backend in torch.compile now works on Windows. We support MSVC (cl), clang (clang-cl) and Intel compiler (icx-cl) for Windows inductor currently.

See the [tutorial](https://pytorch.org/tutorials/prototype/inductor_windows_cpu.html) for more details.
#### [Prototype] FP16 support on CPU path for both eager mode and TorchInductor CPP backend
Float16 is a commonly used reduced floating point type for performance improvement in neural network inference/training. Since this release, float16 for both eager and TorchInductor is supported on the CPU path.
#### [Prototype] Autoload Device Extension
PyTorch now supports autoloading for out-of-tree device extensions, streamlining integration by eliminating the need for manual imports. This feature, enabled through the torch.backends entrypoint, simplifies usage by ensuring seamless extension loading, while allowing users to disable it via an environment variable if needed.

See the [tutorial](https://pytorch.org/tutorials/prototype/python_extension_autoload.html) for more information.
#### [Prototype] Enhanced Intel GPU support
Intel GPUs support enhancement is now available for both Intel® Data Center GPU Max Series and Intel® Client GPUs (Intel® Core™ Ultra processors with built-in Intel® Arc™ graphics and Intel® Arc™ Graphics for dGPU parts), which is to make it easier to accelerate your Machine Learning workflows on Intel GPUs in PyTorch 2.5 release. We also enabled the initial support of PyTorch on Windows for Intel® Client GPUs in this release.
- Expanded PyTorch hardware backend support matrix to include both Intel Data Center and Client GPUs.   
- The implementation of SYCL* kernels to enhance coverage and execution of Aten operators on Intel GPUs to boost performance in PyTorch eager mode. 
- Enhanced Intel GPU backend of torch.compile to improve inference and training performance for a wide range of deep learning workloads.  

These features are available through PyTorch preview and nightly binary PIP wheels. For more information regarding Intel GPU support, please refer to [documentation](https://pytorch.org/docs/main/notes/get_start_xpu.html).

## Backwards Incompatible changes

### Distributed

- [c10d] Remove Option for ProcessGroup and Expose backend Options to reflect the correct code structure (#132931)
  - We released Dispatchable collectives in 2.0 and we will use Backend Option for Backend initialization and the PG options are not needed any more.
  - In 2.4 and before, users can do:
  ```py
  # Users can pass in a basic option when creating an instance of ProcessGroup
  base_pg_options = ProcessGroup.Options(backend=str(backend))
  base_pg_options._timeout = timeout

  pg: ProcessGroup = ProcessGroup(
    store, rank, group_size, base_pg_options
  )

  # Users then need to create a backend option to create the comm backend (e.g., ProcessGroupNCCL)
  pg_options = ProcessGroupNCCL.Options()
  backend = ProcessGroupNCCL(
    store, rank, group_size, pg_options
  )
  ```
  - But from 2.5 onwards, users don’t need to pass in an option to create an instance of ProcessGroup and user can still set default backend for the pg since users still try to get default backend in the code:

  ```py
  # No basic option is passed in when creating a instance of ProcessGroup
  pg: ProcessGroup = ProcessGroup(store, rank, group_size)
  pg._set_default_backend(Backend.backend_type_map[backend])
  # Users then need to create a backend option to create the comm backend (e.g., ProcessGroupNCCL)
  pg_options = ProcessGroupNCCL.Options()
  backend = ProcessGroupNCCL(
    store, rank, group_size, pg_options
  )
  ```

### Export

- Remove `dynamic_dim()` (#134211)  
  - The `dynamic_dim()` method for specifying dynamic shapes in `torch.export()` has been removed. Please refer to the [export tutorial](https://pytorch.org/tutorials/intermediate/torch_export_tutorial.html#constraints-dynamic-shapes) for using `Dims` to specify dynamic shapes.

### Inductor

- [Torch] Support meta device in checkpoint (#132684)
- Switch to internal benchmarking and update benchmarking path (#132827)

  This change moves from using triton’s benchmarking utils to the internal inductor utils at `torch._inductor.runtime.benchmarking`. To update your benchmarking code:

  ```py
  # before
  from torch._inductor.runtime.runtime_utils import do_bench_gpu
  # ...
  do_bench_gpu(kernel, rep=40, fast_flush=True)

  # after
  from torch._inductor.runtime.benchmarking import benchmarker
  # ...
  benchmarker.benchmark_gpu(kernel_call, rep=40, fast_flush=True)
  ```

### mps

- [MPS][BE] Delete MacOS-12.3 specific checks (#133141)

### nn

- Update fused kernels and call _safe_softmax from SDPA (#131863)  
    
  Before this PR, fully masked rows in the `attn_mask` passed to `nn.functional.scaled_dot_product_attention` would yield NANs in the output, after this PR, fully masked rows yield 0s.

  Example:

  2.4.0

  ```py 
  B, S, D = 1, 1, 128

  q = torch.randn(B, S, D, device='cuda')  
  k = torch.randn(B, S, D, device='cuda')  
  v = torch.randn(B, S, D, device='cuda')

  attn_mask = torch.tensor([False], device='cuda')

  F.scaled_dot_product_attention(q, k, v, attn_mask=attn_mask)  
  tensor([[[nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan,  
            nan, nan, nan, nan, nan, nan, nan, nan, nan]]], device='cuda:0')  
  ```

  2.5.0

  ```py 
  B, S, D = 1, 1, 128

  q = torch.randn(B, S, D, device='cuda')  
  k = torch.randn(B, S, D, device='cuda')  
  v = torch.randn(B, S, D, device='cuda')

  attn_mask = torch.tensor([False], device='cuda')

  F.scaled_dot_product_attention(q, k, v, attn_mask=attn_mask)  
  tensor([[[-0., -0., 0., -0., 0., 0., -0., -0., -0., -0., 0., -0., -0., -0., 0., -0., 0., 0., -0., -0., 0., -0., -0.,  
            0., 0., -0., 0., -0., -0., 0., -0., -0.]]], device='cuda:0')  
  ```

### Optimizer Frontend

- Add support to `GradScaler` for respecting an already set `grad_scale` value (#123429)

### Python Frontend

- No more CPython 3.8 support and removal from binary (#132138)  
  CPython 3.8 is now EOL and PyTorch 2.4 is the last version that is supported.  
  See [https://devguide.python.org/versions/](https://devguide.python.org/versions/) for CPython EOL timelines and [https://github.com/pytorch/pytorch/blob/main/RELEASE.md\#python](https://github.com/pytorch/pytorch/blob/main/RELEASE.md#python) for PyTorch’s support CPython version policy.

### ONNX
#### Options to `torch.onnx.export` (except for the first three arguments) are now keyword-only (#131501)

Options can be supplied by keywords only to allow for future addition and evolution of the `torch.onnx.export` API.

Example:  
Version 2.4  
```python  
torch.onnx.export(model, input, f, True, False)  
```

Version 2.5:  
```python  
torch.onnx.export(model, input, f, export_params=True, verbose=False)  
```

#### Deprecated internal API `torch.onnx._export` has been removed (133824)

`torch.onnx._export` is an internal API which is not meant for public consumption. Use the public `torch.onnx.export` instead.

Example:  
Version 2.4  
```python  
torch.onnx._export(...)  
```

Version 2.5:  
```python  
torch.onnx.export(...)  
```

#### The `op_level_debug` option from `torch.onnx.ExportOptions` has been removed (#134961)

This option, designed to identify operator discrepancies, proved unreliable and has been removed. Instead, use `torch.onnx.export(..., report=True, verify=True)` option to validate exported models.

#### The `ONNXProgramSerializer` class has been removed (#135261)

The ONNX model in `torch.onnx.ONNXProgram` is now maintained and serialized by [ONNX IR](https://github.com/microsoft/onnxscript/blob/main/onnxscript/ir/README.md).  
`textproto`, `onnxtext`, and `json` formats are supported by default when calling `ONNXProgram.save()` with a corresponding file extension.

#### The `SymbolicContext` class has been removed (#132184)

The deprecated `torch.onnx.SymbolicContext` class has been removed. (Non-dynamo) custom symbolic functions can no longer take `ctx: torch.onnx.SymbolicContext` as the first argument.

#### Support for caffe2 has been removed (#129021)

- Remove Caffe2 handling from `onnx_unpack_quantized_weights` (#129021)  
- Remove `is_caffe2_aten_fallback` in `torch.onnx.symbolic_helper`

#### Some errors classes are removed

`CheckerError` and `InvalidExportOptionsError` are removed. Users can always catch `RuntimeError` to handle torch.onnx export errors.

## Deprecations

### Dynamo

- Remove `torch._dynamo.utils.CompileProfiler` (#135133)

### Export

- Deprecate `None` for specifying static dimensions in `dynamic_shapes` (#134877)<br>
  The use of `None` at the dimension-level for specifying dynamic shapes is now deprecated, and a user warning will be raised, so please use `Dim.STATIC` in its place. Specifying `None` for an entire input, or an entire program, is still supported. 

### Inductor

- aot_autograd: copy metadata from fw to bw nodes (#126573)
- deprecate `search_autotune_cache` (#133628)

### Releng

- Deprecate Python 3.8 support from CI/CD (#133621, #133624, #135245)

### ONNX

#### Supplying model keyword arguments to `torch.onnx.export` is deprecated (#131501)  
The ability to supply model keyword arguments as a final dictionary is deprecated. Users should use the `kwargs` parameter instead.

Deprecated:  
```python  
torch.onnx.export(model, (arg1, arg2, {“kwarg1”: …}))
```

Future:  
```python  
torch.onnx.export(model, (arg1, arg2), kwargs={“kwarg1”: …})  
```

#### `torch.onnx.OperatorExportTypes` is deprecated (#131501)

The ability to supply `operator_export_type` in `torch.onnx.export()` is deprecated. Exported ONNX graphs will always use the ONNX opset domain. Options `ONNX_FALLTHROUGH`, `ONNX_ATEN` and `ONNX_ATEN_FALLBACK` are no longer supported. The `OperatorExportTypes` class will be removed in a future release.

#### The `training` option in `torch.onnx.export` is deprecated

Set the model training mode first before exporting instead.

Deprecated:  
```python  
torch.onnx.export(model, inputs, path, training=torch.onnx.TrainingMode.EVAL)  
```

Future:  
```python  
model = model.eval()  
torch.onnx.export(model, inputs, path)  
```

## New features

### Autograd frontend

- Add selective activation checkpoint support to `torch.utils.checkpoint` (#125795, #129262)

### Distributed

#### Flight Recorder with an analyzer  
  - Flight Recorder captures diagnostics information as collectives run- right now only for NCCL collectives. The captured diagnostic information is used to help root cause issues when jobs get stuck or timeout. An available analyzer script runs known heuristics using the collected data and attempts to automatically identify the underlying issue that caused the job to stall. (#110960, #113678, #114615, #114651, #114810, #114817, #115090, #115139, #115176, #115358, #115851, #118044, #118046, #118047, #119249, #119748, #119837, #120063, #120262, #120724, #120975, #122731, #126581, #126581, #126726, #128190, #128781, #128948, #129505, #130764, #131268, #133150, #133237, #133933, #133412, #134383, #134528, #134780, #134794)
 
#### c10d  
  - Enabled symmetricMemory-based, low contention intra-node `all-gather` and `reduce-scatter` (#130583)

### Dynamo

- Introduce `torch._dynamo.config.enable_compiler_collectives` for syncing compilation across ranks (#130935)

### Export

- `export_for_training [WIP/unstable]` (#129092, #130062, #134677, #135549)  
- Automatic dynamic shapes (#133620, #134486, #134702)

### Inductor

- [inductor] Add Triton template for Conv3D (#129518)  
- Autoheuristic: add config options for specifying for which optimizations to collect data, and for which optimizations to use learned heuristics (#130245)  
- Automatic horizontal fusion for Inductor ComboKernels (#131675)  
- Mode to emulate amp numerics (#131595)  
- [halide]The issue Add GPU support for the Halide backend adds the necessary functionality to enable GPU acceleration in PyTorch's Halide backend, improving compatibility with GPU-based computation and enhancing performance for specific workloads.(#127506)  
- [halide]The issue Enable bfloat16 support for the Halide backend introduces support for bfloat16 (bf16) data types in the Halide backend of PyTorch, expanding its capability to handle lower-precision computations and improving performance for models that benefit from mixed-precision training.(#129036)  
- [halide]The issue Support scan kernels in the Halide backend adds support for scan operations in PyTorch's Halide backend, enabling efficient reductions across multiple axes in tensors(#129035)  
- The issue Support adding a new inductor backend using PrivateUse1 enables the registration of a custom backend using the PrivateUse1 device type in PyTorch's inductor, facilitating backend extensions and new device types for specialized hardware.(#129953)  
- [halide]The issue Random number generation for the Halide backend introduces support for random number generation in PyTorch's Halide backend, enabling randomized operations for certain tensor computations that previously lacked support.(#130211)  
- [aoti] The issue Add packaging solution introduces a packaging solution for AOTInductor, allowing AOT-generated files to be packaged into a zipfile and loaded in Python. This feature supports the compilation and loading of precompiled models, enabling a more efficient workflow for distributed models (#129895)  
- Adds support for matrix decompositions when working with tensors that have unbacked sizes.(#128655)  
- Adds support for Intel GPUs by splitting reduction operations.  (#129120)  
- Introduces a benchmark flag for inductor configuration, enhancing test workflows.  (#129034)  
- Adds support for nested kernels in Triton when using indirect indexing.  (#129223)  
- Introduces a composable kernel backend for ROCm-enabled devices in PyTorch's inductor.  (#125453)  
- Adds support for mutating input tensors within CUDAGraph trees.  (#129184)  
- Enables vectorization for bitwise operations in the C++ backend.  (#129733)  
- Adds support for quantized linear GEMM templates with FP32 outputs.  (#128825)  
- Extends GEMM template support to INT8 output with unary post-operation support.  (#129048)  
- Adds support for binary fusion in GEMM templates for quantized linear operations.  (#129103)  
- Adds support for AMX micro-GEMM kernel with int8 data type for quantized linear operations.  (#129220)  
- Extends UserDefinedTritonKernel to support multiple outputs.  (#129325)  
- Enables support for handling multiple outputs in FlexAttention operations.  (#129344)  
- Introduces visualization methods for block masks in FlexAttention.  (#129950)  
- Introduces the initial implementation of the B2B-GEMM pass with accompanying tests.  (#129995)  
- Adds support for FX graph caching on AMD GPUs.  (#130463)  
- Adds a GroupedSchedulerNode to handle nodes that need to be scheduled together in FSDP2.  (#128568)  
- Adds support for flex decoding in FlexAttention's high-order programming (HOP).  (#129415)  
- Adds partial masking support to FlexAttention. (#130415)  
- Adds a DeferredCudaGridLine wrapper for CUDA grid operations.  (#129268)  
- Adds support for folding conv_bn with mixed data types in the post-grad phase.  (#133968)  
- Enables OpenMP support in the inductor when using the Intel compiler on Linux.  (#134973)  
- Enables the use of CUDA graphs even when there are unused CPU inputs.  (#134749)  
- Adds support for MKLDNN convolution operations in the C++ wrapper for inductor.  (#134475)  
- Introduces support for generalized linear operations using MKLDNN in the C++ wrapper.  (#134783)  
- Extends support for quantized convolution operations in MKLDNN via the C++ wrapper.  (#134795)  
- Adds support for unbacked symbolic integer (symint) divisors in variables and sizes.  (#130595)

### nn

- Made `FlexAttention` API public (#130755)  
- Add `nn.Modules.set_submodule()` like `get_submodule` (#127714)  
- Add `nn.Buffer` like `nn.Parameter` (#125971)

### Optim

- Add an Adafactor impl (forloop and foreach) (#129905, #132336)  
- Add support for capturable optimizers on hpu and xpu (#132119)

### Optimizer Frontend

- Disable expandable segments checkpointing internally (#132048)

### Profiler

- [Profiler] Collect observer traces from C++ child threads (#128743)  
- [Profiler][XPU] Introduce kineto-based XPU profiler (#130811)  
- [Profiler] Add API for Dynamic Activity Toggling [2/n] (#133035)  
- [Memory Snapshot][Viz] Show event timestamps if collected (#132523)  
- [Memory Snapshot][Viz] Add Allocator Settings Tab (#132518)  
- [Profiler] Add kwargs to Kineto Traces (#130373)

### Python Frontend

- Add support for device extension autoloading (#127074)  
- Added support for sharing tensors on the meta device between processes (#129520)  
- add `__torch_function__` handler to `Tensor.get_device` cpp (#132567)  
- Add `torch.serialization.skip_data` context manager to create a metadata-only checkpoint (#134504)  
- Add `torch.serialization.safe_globals` context manager to work with weights_only serialization (#127939)

### Quantization

#### PT2E Numeric Debugger

- Preserve `_numeric_debug_handle` throguh deepcopy and re-export (#129287)  
- Add `numeric_debugger` top level APIs (#130643)  
- Update pt2e numeric debugger to use `node.meta["custom"]` field (#134040)  
- Fix output node's meta (#131706)

### Releng

- Split Build - Create a distribution of pytorch which is composed of a c++ component and mostly python component similar to jax and jaxlib (#129088, #127934, #126813, #129011, #129270, #129253, #129269, #129774, #132537, #124995, #134624)  
- Intel GPU enablement in CI/CD. Add prototype Linux Manywheel binary builds with better ATen operation coverage and improved torch.compile support (#129730, #129560, #128486, #130742, #130922, #133069, #132854, #129847, #134074, #134204, #134214, #134461, #134464, #134455, #134312, #133151, #124147)  
- Add prototype Linux Manywheel Python 3.13 binary builds (#130030, #132984, #133670)

### XPU

- Improve ATen operation coverage and support Intel Client GPUs in addition to Intel Data Center GPUs (#135833)   
- Enable Windows support and enable PyTorch wheel build for Windows (#135833, #133151, #134312)   
- Enable deterministic support for Intel GPU operations (#127277, #129864)   
- Support _GLIBCXX_USE_CXX11_ABI both 0 and 1 mode (#130110)

### Sparse Frontend

- Add pinned memory support to COO/CSR/CSC/BSR/BSC tensors (#129645)  
- Add MaskedTensor support to _is_any_true (#128574)  
- Add MaskedTensor support to *_like API, example: empty_like, etc. ops (#128637)  
- Add MaskedTensor passthrough: unfold, F.Unfold, F.Fold, stack (#125262)

### ONNX

#### The `dynamo=True` option and new export logic (#132530, #133743, #134304, #134782, #135378, #135399, #135786, #136162, #135134, #134976, #135367, #135418, #135591, #135520)

We introduce the `dynamo=True` option in `torch.onnx.export()`. This is recommended as a replacement for `torch.onnx.dynamo_export` starting in PyTorch 2.5.

Version 2.5:  
```python  
onnx_program = torch.onnx.export(model, inputs, kwargs=kwargs, dynamo=True)  
# Use the external_data option to save weights as external data  
onnx_program.save(“model.onnx”, external_data=True)  
# To save without initializers  
onnx_program.save(“model.onnx”, include_initializers=False, keep_initializers_as_inputs=True)  
```

`torch.onnx.export(model, args, dynamo=True, report=True, verify=True)` leverages `torch.export` and [ONNX IR](https://github.com/microsoft/onnxscript/blob/main/onnxscript/ir/README.md) to convert captured `ExportedProgram`s to ONNX efficiently and robustly. This new process reduces memory consumption by half compared to `dynamo_export` in 2.4, while preserving rich tensor shape and stack trace information in the ONNX graph. You can leverage the `report=True` option to obtain a conversion report in markdown format to diagnose any conversion issues. Set `verify=True` to verify the ONNX model numerically with ONNX Runtime.

When using `external_data=True` to save model weights as external data to the .onnx file, weights larger than 1 MB are now aligned at 64 KB addresses. This allows runtimes to memory-map weights for better memory efficiency during inference.

> [NOTE]  
> The `dynamo=True` option currently supports only ONNX opset 18. Future releases will expand support to newer opsets.

> [NOTE]  
> The `dynamo=True` option requires the latest versions of `onnxscript` and `onnx` packages.

## Improvements

### Autograd frontend

- Support GradientEdge as output for `torch.autograd.grad` (#127766)  
- `torch.autograd.graph.increment_version` accept List[Tensor] (#132652)  
- Hooks registered via `torch.autograd.graph.Node.register_hook` during Node execution are run (#134728)

### Compostability

#### Custom ops:

- Improvements to torch.library.custom_op  
  - Supported calling from a multithreaded context (#128547)  
  - Improved overhead when autograd is unnecessary (#127976)  
  - Made it compatible with `from __future__ import annotations` (#128809)  
  - Supported string default values in schema (#129179)  
  - Added better suggestions for unsupported types (#129417)  
  - Added `mutates_args=”unknown”` for if you didn’t know the alias information of your custom op (#129614)  
  - Added ability to add default values for device types (#129792)  
  - Added ability to construct factory functions  (#129978)  
  - Added ability to temporarily disable kernels (#130190, #130406)  
  - [docs] Redirect custom ops landing page to the correct place (#129177)  
  - Prevented Dynamo from peeking into torch.library.{custom_op, register_kernel} (#133125)  
  - Improve aliasing error message (#134688)  
- Miscellaneous  
  - `register_flop_formula` now actually does something for custom ops (#131777)  
  - Improved torch.library.opcheck docs. (#134692)

#### Dynamic shapes:

- User facing features offering more control over dynamism  
  - [dynamic] config to disable duck sizing (#129804)  
  - Trigger dynamism on stride changes (#130232)  
  - Add mark_unbacked (#128638)  
- Unbacked SymInt support  
  - Fix set_unbacked_bindings when list of Tensors is returned (#133585)  
  - Compute and do renamings even when ignoring fresh unbacked symbols (#134407)  
  - Also preserve unbacked SymInts when partitioning as backward inputs (#128338)  
  - Improve unbacked reasoning involving has internal overlap (#128332)  
  - Make are_strides_like_channels_last size oblivious (#129677)  
  - Correctly put mark_unbacked symbols in shape_env_to_source_to_symbol_cache (#129869)  
  - Don't attempt to compute hints for unbacked expressions (#132060)  
- Export related bug fixes  
  - Fix ConstraintViolationError exception string when exprs are int (#129271)  
  - suggested fix for data-dependent error (#125378)  
  - carry cond in data-dependent error (#131932)  
  - add src map to data-dependent errors (#132393)  
  - check unsupported sympy functions for runtime asserts (#132457)  
  - fix silly error when printing diff (#133345)  
  - remove dead code for suggesting legacy dynamic shapes fixes (#133700)  
- Improved symbolic reasoning, including performance improvements  
  - Remove some implications from the static_eval pattern matcher (#128500)  
  - Replace sympy Min/Max with reimplementations (#133319)  
  - Fixed dynamic shape inference  (#128807)  
  - remove redundant upper bound check at runtime (#133627)  
  - Remove dead expect_rational (#135105)  
  - Stop updating hints (#129893)  
  - Don't constrain range on the replacement for a symbol (#129907)  
  - Make sym_node log more useful (#130436)  
  - When translation validation is enabled, assert that hint is consistent (#130478)  
  - Add trace_shape_events artifact tracing for ShapeEnv events (#130473)  
  - FakeTensor cache SymInt support (#127596)  
- Dynamic shapes improvements to specific operators  
  - [PT2] Resolve PT2 compatility issue in slice and diff (#133740)  
  - Use integer divison in arange length calculation when start/end/step are integral (#134296)  
  - Remove unnecessary expect_true in split_with_sizes (#133439)

#### Decompositions, FakeTensor and meta tensors

Operator decompositions, FakeTensors and meta tensors are used to trace out a graph in `torch.compile` and `torch.export`. They received several improvements:

##### Decompositions:  
  - Fixes to existing decompositions:  
    - rot90 (#129097)  
    - aten.slice_scatter (#123744)  
    - bucketize (#133652)  
    - torch.istft (#135234)  
    - torch.exp (#129154)  
    - aten._to_copy (#130381)  
    - aten.masked_fill_ (#127871)  
    - const_pad_nd (#132679)  
  - New operator decompositions:  
    - aten.channel_shuffle (#118775)  
    - aten.nll_loss2d (#133534)  
    - aten.reflection_pad{1,2,3}d_backward (#130299)  
    - aten._unsafe_index_put (#133365)  
##### Meta tensors:  
  - Fixes to existing meta tensor op implementation  
  - aten._scaled_mm (#129521)  
  - _convert_weight_to_int4pack (#130707) 
  - New meta tensor op impls  
      - _fused_adamw_ (#133728)  
      - poisson (#134103)  
##### Misc fixes:  
  - Infer prim tags from equivalent aten ones (#130367)  
  - Fix dim order calculation for channels_last in decomps (#131366)  
  - Allow cross-device copies for cpu scalars in refs (#135140)  
  - Update fake tensor error checks for bool tensor subtraction (#128492)

### Cpp frontend

- Add `padding_side` to `pad_sequence` with `"left"` and `"right"` options (`"right"` as default) (#131884)  
- Add out variants to avg_pool1d and adaptive_avg_pool1d (#135051)

### Cuda

- [BE] Improve CUDA UpSample error message (#131252)  
- Reduce number of guards introduced by check_cudnn_tensor_shapes when cudnn version is higher enough (#132384)  
- [CUDA]: Add frexp CUDA bfloat16 support (#133313)  
- Allow torch.cuda.memory.mem_get_info to take a device str argument with an unspecified device index. (#132616)  
- Change index_put on GPU to accept FP8 inputs (#128758)

### Distributed

#### Activation Checkpointing (AC)
  - Added `kwargs` to composable AC API to enable full capabilities (#128516)
  - Made `ActivationWrapper` an abstract class (#129808)
#### c10d
  - Applied `somaxconn` and enabled `TCP_NODELAY` to `TCPStoreLibUvBackend` (#128739)
  - Improved connect and retry logic for `TCPStore` (#129261)
  - Added pings to verify network connectivity on connect for `TCPStore` (#129985)
  - Made `new_group` eager when used with `comm_split` (#129284)
  - Exposed running handlers from Python for control plane (#130149)
  - Added new control plane handler (#129712)
  - Added a new Pytorch API `split_group` to create a process group (#130507)
  - Add `bfloat16` support for NAN check (#131131)
  - Enabled custom work registration from python in the Functional Collective (#130354)
  - Not removed collective ops in dce since they have side-effect in the Functional Collective (#131023)
  - Used float tensor for `ProcessGroupNCCL` barrier `all-reduce` (#132701)
  - Set a shorter heartbeat detect timeout to avoid race with `ProcessGroupNCCL` watchdog timeout (#133028)
  - Made it not call `ncclCommAbort` if comm is not initialized (#133630)
  - Made it not broadcast uniqueId during a split (#133962)
  - Reconciled barrier and NaN checker (#134707)
  - Releases gil lock during eager init (#134779)
  - Improved logic to infer device for barrier (#134617)
#### DeviceMesh
  - Added supports for non-continuous slicing (#132310)
#### Dtensor
  - Moved `DTensor` to public namespace (#134203)
  - Made `slice_backward` to use op strategy (#130287)
  - Improved `from_local` API with run_check (#130289)
  - Added a few dunder methods to pointwise ops (#130754)
  - Added naive support for `nn.init.orthogonal_` (#132104)
  - Added support for custom op registration (#131108)
  - Added more foreach ops to supported sharding prop list (#132066)
  - Added naive replicate strategy for more diagonal ops (#132201)
  - Rewrote redistribute algorithm for multi-dim mesh (#131210)
  - Added missing all to public modules (#133305)
  - Made DTensor sharding propagation for `scaled_dot_product_efficient_attention` and `scaled_dot_product_flash_attention` more conservatively cached (#134146)
  - Extended implicit replication to replicate `DTensor` for foreach ops so model doesn't have to be fully tp-ed when using 2D (#134551)
  - Added gradient scaler for `DTensor` (#132816)
#### DistributedStateDict (DSD)
  - Kept 'exp_avg' as `DTensor` after `torch.distributed.checkpoint.state_dict.set_optimizer_state_dict` (#128004)
  - Correctly handled shared parameters for optimizer `state_dict` (#128685)
#### FullyShardedDataParallel (FSDP)
  - Integrated device agnostic APIs in FSDP library (#134337)
  - Made `clip_grad_norm_` norm compute order deterministic (#134673)
  - Casted input args with `dataclass(frozen=True)` (#135067)
  - Avoided GPU syncs by reusing Pre-allocated Zero Tensor (#128069)
#### fully_shard (FSDP2)
  - Included module FQN in `FSDPParamGroup` `record_functions` (#128624)
  - Added APIs for explicit fwd/bwd prefetching (#128884)
  - Added `set_post_optim_event` (#128975)
  - Ran reduce-scatter copy-in in default stream (#129721)
  - Relaxed `contract` to allow `Sequence[nn.Module]` (#127773) (#130947)
  - Allowed `List[nn.Module]` as arg (#130949)
  - Preserved `fsdp.set_ op` through lowering (#130786)
  - Added `set_reduce_scatter_divide_factor` (#129286)
  - Added hpu device to `_get_remote_device_str` (#132120)
  - Added repr to `FSDPParamGroup` and `FSDPParam` (#132350)
  - Added missing event wait (for future) in FSDP2 (#132568)
  - Let `fsdp.set_` convey to functionalization that it mutates storage (#132322)
  - Enabled autoselect default device in FSDP construction. (#127609)
  - Reset `FSDPParam.sharded_param` in `lazy_init` (#132954)
  - Enabled HSDP + TP in FSDP2 (#133335)
  - Added eager fast-path for fp32->bf16 param cast (#133369)
  - Kept DTensor params for `replicate` and `fully_shard` (#133059)
#### TorchElastic
  - Shared `TCPStore` by default when using `c10d_rendezvous_backend` (#128096)
  - Used `wait` instead of `get` for store barrier (#130148)
  - Added missing rank tracing support in the barrier inside TorchElastic (#132818)
  - Made torch elastic not have to realize `TCPStore` backend type and rely on c10d to decide which backend to use (#134882)
  - No signal handling when off the main thread (#135088)
  - Supported `local_addr` across all rendezvous implementations (#135262)
  - Created processes in parallel in `mp.start_processes` for `forkserver` (#134629)
#### TensorParallel(TP)
  - Improve `SequenceParallel` and its documentation (#131346)
#### Pipelining
  - Supported separate `dw_runner` for PipelineStage (#128983)
  - Supported arbitrary stage ordering on ranks (#128976)
  - Supported W action for schedules (#129233)
  - Added to/from CSV format and improved repr (#129264)
  - Implemented flexible PP schedule (#129597)
  - Reordered `_Action` from `F1_1` to `1F1` (#129786)
  - Added forward only schedule (#132177)
  - Added schedule `unshard/reshard` pass (#129810)
  - Added schedule `send/recv` pass (#130378)
  - Added `zb1p` schedule (#130210)
  - Added `get_schedule_class` util (#132768)
  - Added pytorch-native input/weight grad split (#132691)
  - Added ZeroBubble schedule (#133467)
  - Unblocked zero bubble composability with DP (#134052)

### Dynamo

- More tracing support: (non-exhaustive list) - 
  - - Weakref objects (#128533) - 
  - Some set methods (e.g. `discard` (#133317), `intersection` (#130672), `remove` (#132943))  
  - Support for proxying frozen dataclasses (#134846)  
  - `inspect.signature.bind` (#132330) and `inspect.signature.Parameter` attribute access (#134636)  
  - `random.Random` objects (#133725)  
  - User-defined method descriptors (#130159)  
  - `set` on `KeysView` (#131389)  
  - `dict` conversion of objects derived from `MutableMapping` (#131367), constrained subclasses of dict and OrderedDict (#132558)  
  - `__contains__` on `__dict__` of user defined classes (#131378)  
  - `abc.MutableMapping.get` (#132363)  
  - `frozenset` (#134563)  
  - reading attributes from pybind objects (#134630)  
  - classes with custom `__new__` (#132977), `object.__new__` (#133746)  
  - `torch.cuda.device` (#133385)  
  - `id(Parameter)` (#130100)  
  - `str` on UserDefinedObjectVariable (#130506)  
  - `out`-variant custom ops that return None (#129078)  
  - `autograd.Function` `mark_non_differentiable` (#134087), `ctx.set_materialize_grads` (#133978)  
  - Better support for HuggingFace `ModelOutput` class (#127780)  
- `mark_static` can now be used on `nn.Module`s to make int attributes static (instead of automatic dynamic) (#134713)  
- Recursively skip frames when Dynamo cache limit is hit (#135144)  
- Context hints for backend compilers (#132860)  
- Add queue_callback() support (#126366)  
- Suppress guards generated by empty_strided in ir_node_to_tensor (#130431)

### Export

- Effect token support for TorchBind calls (#128397)  
- Pretty printing for unflattener (#128617)  
- Decomposition support for `export_for_training` (#128077, #129249, #134801)  
- Add CSE and SymInt compute optimization to export graphs (#130380)  
- Check node schema for side-effectful ops when DCE-ing (#130552)  
- Experimental joint-graph export API (#128847)  
- Dynamic shapes serialization (#134718)  
- Suggested fixes for data-dependent errors in non-strict mode (#125378)  
- Kill forced specializations, and prefer runtime asserts for dynamic shapes (#130775, #132698)  
- Fully support extension operators in de/serialization (#130851)  
- Fully handle preserved_ops with `run_decompositions()` (#130970, #131075)  
- Add `torch.amp.autocast_mode` as a higher-order-op subgraph (#132677)  
- Make `ExportedProgram.validate()` public-facing (#132777)  
- Allow string outputs for ExportedPrograms (#132808)  
- Better user error messages for dynamic_shapes mismatches (#132982)  
- Add a graph & node-level `“custom”` metadata field (#131912)  
- Add a `getitem` deduplication pass (#133618, #134830)  
- Make `move_to_device_pass` public-facing (#134263)  
- Make `while_loop` higher-order-op public-facing (#128562)  
- `TORCHEXPORT_EXTENDED_DEBUG_CURRENT_LOC=1` flag for line-by-line debugging in non-strict mode (#134298)  
- Support `aten.full.default` and `aten.full_like.default` (#130639)  
- Handle python list append, list add, `aten.to.dtype` + `mutation_op` pattern for TSConverter (#132529)  
- Quantized ops to standard ops pass. (#133026)  
- Add `InterpreterModule` to trace_rules (#132949)  
- Add `tracing_mode` support for TorchBind (#129586)  
- Inline True branch for torch.cond when predicate is a Python constant (#130493)  
- Support Unbacked SymBool inputs for torch.cond (#133589)  
- Support `set_grad_enabled` higher-order-op in dynamo to enable re-tracing (#134281)

### ForEach Frontend

- Increase parity for dtype support for `_foreach_sigmoid` and `_foreach_lgamma` (#134253, #134344)

### Fx

- Use to_dtype node and const folding in convert fp32 to fp16 fx pass (#127829)  
- Add decomposition_table as an arg to `get_isolated_graphmodule` (#130886)  
- Support `meta["val"]` that is a dict, for triton kernels and for the partitioner (#132466)  
- Allow SymInt input for torch.fx reinplace pass (#133178)  
- Add `max_acc_splits` (#133041, #133724)  
- Update source matcher to use torch_fn (#133642)  
- Set maximum warning count during `fx.Graph.lint` (#135069)  
- Graph Printing:  
  - Change colored logging to only be turned on if printing to interactive terminal (#128874)  
  - Print float with full precision, don't truncate (#130027)  
  - Save DOT file of graph instead of SVG for GraphTranformObserver (#128634)  
  - Add normalize_args constructor argument to FxGraphDrawer (#130348)  
  - Show size/strides for all tensors in `python_code(verbose=True)` (#132192)  
- Fix py codegen to delete values that don't have any users (#131028)  
- Propagate sparsity in fx graph (#131920)

### Inductor

- Inductor windows support improvements (#134772, #133921, #131767, #131980, #132025, #132326, #132533, #132491, #132630, #132848, #132841, #132973, #133184, #134033, #134229, #134358, #134348, #134397, #134402, #134400, #134401, #134419, #134420, #134394, #134424, #134426, #134427, #134221, #132387, #132394, #132571, #134365)  
- Autoheuristic improvements (#130304, #133608, #131610, #132685, #131615, #131714, #131710)  
- ROCm Support: enable dynamic shapes for CK backend (#133285)  
- ppc64le: VSX Support for Inductor (#132746)  
- Add an option to exclude CPU overheads using `do_bench_using_profiling` in `TORCHINDUCTOR_PROFILE` (#133523)  
- Add thread blocking config `TORCHINDUCTOR_CPP_GEMM_THREAD_FACTORS` (#132730)  
- FlexAttention improvements (#133019, #132015, #133159, #134065, #134351, #133836, #133664, #132157, #131559, #132547, #131404, #131552, #130904, #134055)  
- Make config.autotune_remote_cache be a three-way option (#132285)  
- Add config option to force higher-dimensional tiling (#132937)  
- Add torch.save() for individual intermediate tensor (#133871)  
- Add inductor config: masked_vec (#134566)  
- Add dynamic shapes for combo_kenel/foreach_kernel (#134477)  
- Add Inductor config for default stride behavior (#135238)  
- Optionally allow padding on non-GPU devices (#135280)  
- Make conv template work with dynamic stride/padding (#132938)  
- Adds a print_readable function to the unflattener for better debug output, improving readability of the module structure.  (#128617)  
- Adds logging for static input indices in CUDAGraphs to aid debugging.  (#132726)  
- Improves dispatch logic for vectorized instruction sets in CPU code.  (#128320)  
- Adds a shape property to intermediate representation nodes for better shape inference.  (#127818)  
- Supports comprehensive padding for tensor operations, enhancing flexibility in padding schemes.  (#128555)  
- Reduces superfluous mask handling in Triton code generation.  (#128518)  
- Improves fusion logs by making it easier to attribute nodes to the aten graph, aiding in debugging and performance tuning.  (#127159)  
- Ensures mixed_mm operations are only enabled when casting from a lower bitwidth type to a higher one, avoiding unnecessary type conversions.  (#128899)  
- Enables multiple workers to function correctly if the method being used is subprocess.  (#129002)  
- Adopts future annotations for better type hinting and maintainability in the inductor's scheduler and IR.  (#128892)  
- Moves auto-tuning for Triton kernels into a separate block for better performance isolation.  (#129057)  
- Improves convolution dilation by adding a size_hint to optimize memory allocation.  (#129631)  
- Switches the Halide code cache to the new cpp_builder framework for better compilation support.  (#129441)  
- Refactors GEMM template to pass weight data type explicitly.  (#129221)  
- Introduces helper functions to convert score_mod into block_mask in FlexAttention.  (#129909)    
- Updates HalideCodeCache to use the new cpp_builder framework for improved functionality.  (#130146)  
- Limits functions in foreach operations when dependent on multiple subkernels to improve consistency.  (#130046)  
- Introduces improved methods for generating runtime checks for symbolic dimensions.  (#130220)  
- Adds a check to verify if the FX graph returned by aot_compile is a tuple.  (#129824)  
- Adds support for passing a module map to the Triton make_ir API for better modularity.  (#134774)  
- Removes VecChecker and implements a fallback for non-supported vector operations with a scalar loop.  (#134569)  
- Generates a reindexer for each epilogue_node in C++ inductor operations.  (#134984)  
- Adds a padding_value for boundary-checked loads in FlexAttention, improving load operations in corner cases.  (#134573)  
- Improves the way argument names are used as keys in constant and signature dictionaries for better consistency.  (#135170)  
- Removes "spawn" as an option for parallel compilation to avoid issues with certain platforms.  (#130746)  
- Introduces a heuristic to determine whether padding should be applied before matrix multiplication operations.  (#128643)  
- Introduces inductor-specific counters within the FX graph cache for better debugging and performance tracking.  (#130635)  
- Adds a counter for num_matches_for_scatter on constant tensors to the cached metrics.  (#130843)  
- The issue Lift inductor lowerings for jagged <-> padded dense kernels introduces lowerings for conversions between jagged and padded dense tensors, supporting operations like _jagged_to_padded_dense_forward and _padded_dense_to_jagged_forward. This improves PyTorch's ability to handle irregular tensor structures efficiently, particularly in tasks like natural language processing where padding is common.(#125968)  
- The issue Add BackendFeature gating introduces a mechanism to gate backend features in PyTorch's inductor based on the availability of specific backend capabilities. This ensures that operations requiring specialized backend support are only enabled when those features are present, improving compatibility and stability.  (#128266)  
- The issue Support additional lifted constants supplied to const folding enhances AOTInductor's constant folding by allowing additional lifted constants from graphs to be included. This update improves compatibility when using lifted graphs in constant folding processes, particularly with the split_const_gm function.  (#130743)  
- The issue Compute q_num_blocks from kv_num_blocks if q_num_blocks is not passed in updates the logic in flex_attention to compute the q_num_blocks from kv_num_blocks when q_num_blocks is not explicitly provided, ensuring consistent behavior across different input configurations. (#130809)  
- The issue Remove static param counting if inlining NN modules eliminates the need for static parameter counting when inlining neural network modules in the inductor backend. This simplifies the logic for handling parameters and improves performance by skipping unnecessary counting. (#130503)  
- The issue Use get_reduction_combine_fn for reduction ops updates the Halide backend by introducing a function that determines how reductions are combined during computation, improving the clarity and efficiency of reduction operations in the backend. (#130212)  
- The issue Use 0D scalar inputs/outputs allows the Halide backend to handle 0-dimensional scalar inputs and outputs, fixing issues related to scalar operations in the Halide integration with PyTorch. (#130129)  
- The issue Change the schema of QLinear Binary modifies the schema to better support the corresponding GEMM templates, making it easier to handle autotuning by reordering tensor inputs. (#129049)  
- The issue Dimension-based indexing for the halide-backend changes the indexing in the generated Halide code to be dimension-based rather than 1D-based, which resolves multiple bugs and performance issues related to indexing in PyTorch's Halide backend. (#129026)  
- The issue Use _unsafe_masked_index in masked_scatter decomposition updates the masked_scatter operation by using the _unsafe_masked_index function in its decomposition, improving performance and reliability.(#123667)  
- The issue Only autotune at compile time when enabled via config ensures that autotuning in AOTInductor only occurs when explicitly enabled via configuration, preventing unintended autotuning during execution unless specified. (#129413)  
- The issue Adjust efficient_conv_bn_eval_graph for inlining modifies the inlining of the efficient_conv_bn_eval_graph function to improve execution during evaluation in PyTorch, particularly for built-in neural network modules. (#128878)  
- The issue Make config.fx_graph_remote_cache be a three-value switch introduces a configuration option allowing fx_graph_remote_cache to be set as True, False, or None, where None disables it for OSS (open-source software) but enables internal configurations for JK. (#128628)  
- Enables GraphTransformObserver for inductor backend.(#127962)

### mps

- [MPS] Add Metal implementation of exp op (#128421)  
- [MPS] Add lu_factor in MPS (#99269)  
- [MPS] Add support for autocast in MPS  (#99272)  
- [MPS] Add support for autocast in MPS  (#99272)  
- [MPS] Enable MPS mm from macOS >= 14.4 (#133494)  
- [MPS] Add support for autocast in MPS  (#99272)  
- [MPS] Add int4mm weight packing mps kernel, and improved int4mm shader (#128965)  
- [MPS] Fast math env var (#129007)  
- [MPS] Check and error message for no support for conv with output_channels > 2^16 (#129484)  
- [MPS] Add tensor_lr overloads to fused adam & adamw (#129451)  
- [MPS] Add SDPA implentation (#131362)  
- [MPS] Add native implementation for shift ops (#131813)  
- [MPS] Add native strided API for MPSNDArray starting with macOS 15 (#128393)

### nn

- Made nn.Module state_dict load_state_dict pre-hook and state_dict post-hook public (#131690)  
- Add deterministic support in nn.functional.interpolate for XPU (#129864)  
- Add batching rule for sdpa_math, sdpa_efficient_attention forward, cudnn, and flash attention (#133964)  
- Support `nn.Module.mtia()` (#131499)

### Optim

- Move fused optimizers’ param's device check to later in `_init_group` to allow better error checking in more cases (#131153)  
- Update typing and 1-element check for tensor lr support on all optimizers (#131065)

### Optimizer Frontend

- Fix fake_tensor w/ non-view tensor (#132050)  
- [BE][optim] Make pyright recognize exported symbols (#135043)

### Profiler

- [Memory Snapshot] Move user_defined annotations to Native Caching Allocator (#130964)  
- [Memory Snapshot] Add recordAnnotations to capture record_function annotations (#129072)

### Python Frontend

- Improve error message for weights_only torch.load (#129705)  
- Add new blocklist for weights_only load to prevent some modules from being allowlisted (#131259)  
- Make PyTorch argparser understand python’s “complex” type (#129580)  
- Allow to register “fallback” to torch.library (#131707)  
- Move module_tracker to general logging system when reporting confused hierarchy (#134467)  
- Make `torch.serialization.set_default_mmap_options` usable as a context manager (#134371)

### Quantization

#### PT2E quantization

- Support `set_module_name_qconfig` in X86InductorQuantizer (#126044)  
- Enable PT2E symmetric dynamic quantization in metadata porting (#124615)  
- Fix add annotation with constant (#132092)  
- Fix Maxpool2d share quantization params (#132704)  
- Fix getattr for quantizing constants (#132705)  
- Use returned model from Quantizer.transform_for_annotation in prepare_pt2e (#132893)  

#### Observers

- Fix edge cases for HistogramObserver (#129387)  
- Corner-case fix for upscale_histogram in the new HistogramObserver (#130316)

#### Export IR Migration

- Fix batch norm pattern match in quantization (#134157)  
- Fix getitem not exist (#134259)  
- Fix tests for quantized_decomposed.quantize_per_tensor decomposition (#134525)  

#### Others

- Enable torch.empty for float8 dtypes on cpu in deterministic mode (#128744)  
- Fixing equalize with three things and improving functionality (#124632)  
- Fix the warning for cat operators with same qparams (#133999)

### Releng

- Update NCCL to 2.21.5 (#124014)  
- Update cuSPARSELt to v0.6.2 (#134022)  
- Update CI/CD to CUDA 12.4.1 (#132202, #125944)  
- [ROCm] upgrade CI/CD to 6.2, triton-rocm improvements.  (#132875, #133238, #128525, #131637, #129361, #129480, #128873, #127947, #129094)  
- Migrate conda, manywheel, libtorch Docker images build from pytorch/builder to pytorch/pytorch. (#129022, #132410, #133699, #133709)  
- Migrate nightly CD builds to ephemeral runners  (#134469, #134380, #134367, #134463, #134473)

#### Infrastructure

- Remove usages of Rockset as storage in favor of AWS (#129503, #129594, #129544, #130153, #130168)   
- Migrated pytorch/pytorch’s CI to run  on hardware owned by the Linux Foundation (#129246, #129462, #129746, #133225, #133232, #133320, #133124, #133457, #134231, #134796, #134800, #129612, #131325, #131188, #128969, #128985, #129679, #129977, #131955, #132870, #131472, #134128)  
- Upgraded the CI Linux runners to use the Amazon Linux 2023 AMI (#128619, #132918, #131792, #134355, #131246, #131514, #131485, #131677, #131963, #131771, #133036, #133352, #133469, #133355, #133641, #134116, #131821, #131250)

### XPU

#### Intel GPU Backend for Inductor  
  - Generalize GPU type for Intel GPU and CUDA for Inductor Triton backend (#132740)  
  - Initialize AOTInductor support for Intel GPU by supporting store SPIR-V binary file output from Intel Triton. (#130849)  
  - Handle device_put op in constant folding. (#130824)  
  - Support reduction split. (#129120)  
  - Add new prop to _XpuDevicePropertie for triton gemm optimization (#131738)

#### Intel GPU ATen Operation  
  - Allow XPU device in copy, cdist, index_put_impl (#130088)    
  - Customized XPU behavior in indexing, group norm (#134453)   
  - Enable codegen for Intel GPU (#130082)   
  - Enable Dispatch Stub support for Intel GPU (#130019)   
  - Enhance the stability of the complex divide code (#134647)   
  - Add support for XPU accumulate type (#128579)

#### Intel GPU Runtime and Generalization  
  - Device guard codegen for XPU (#133980)   
  - Refactor caching device allocator utils (#130923)   
  - Refactor cached tensor more generic (#129359)   
  - Refine the logic of device construction when only device index is given (#129119)   
  - XPUHooksInterface inherits from AcceleratorHooksInterface (#129463)   
  - Add XPU memory-related APIs (#129919)   
  - Add xpu to getAccelerator (#129205) 

### Nested-Tensor Frontend

- Backward support for unbind() with NJT (#128032)  
- Backward support for cat() with NJT (#132076)  
- Backward support for chunk() on non-batch, non-jagged dimensions for NJTs(#132193)  
- Support linear backward for NJT with dim > 3 (#129393)  
- Accept min / max sequence length in nested_tensor_from_jagged() constructor (#130175)  
- Support sum operator along the jagged dimension for NJTs (#130425)  
- Support mean operator along the jagged dimension for NJTs (#131132)  
- Support permute() for NJT (#135336)  
- Support dtype conversions for NJT (#134164)  
- Support for copy_() when shape is identical for NJTs (#132193)  
- Implement 2D version of masked_select() for NJTs (#133889)

### cuDNN

- [cuDNN][64-bit indexing] cuDNN v9.3+ supports non-batch-splittable convolutions with > 2**31 elements (#134890)  
- cuDNN now supports convolutions with spatial dimensions that require 64-bit indexing. Previously this would fallback to a native im2col or vol2col style implementation that was very memory inefficient and lead to OOMs.

### Sparse Frontend

- Add Half for sparse.mm reduce on CPU (#133672)  
- Add partial support for COO/CSR/CSC/BSR/BSC representation in traced graph (#132690, #134037, #133371, #129983)

### ONNX

- Lazy-import `onnxruntime` (#134662)
- Add upsample trilinear to skip decomp (#128259)
- Add onnx::Gelu support for version 20 (#128773)

### ROCm

- Add warpSize to torch.cuda.get_device_properties (#128449)

## Bug fixes

### Autograd frontend

- Fix case where saved tensors are incorrectly shared version counter (#128545)  
- Fix thread safety of `torch.autograd.graph.register_multi_grad_hook` (#132055)  
- Fix PyObject reference counting of `torch.autograd.graph.saved_tensors_hooks` (#131700)  
- Update `torch.autograd.graph.saved_tensors_hooks` to not detach when unpacking tensors that do not require grad  (#127959)  
- Fix device propagation for `torch.utils.checkpoint` (#128671)

### Compostability

- Fix interaction between `torch.conj()` tensor subclasses and scalar tensors (#131482)  
- Better complex number support for aliasing prim operators (#132699)
- AOTDispatcher is a component in the torch.compile stack responsible for capturing a graph of normalized/functionalized ATen IR as well as capture the backward. A few bugfixes this release:

  - Properly bump version counter on input mutations in inference graphs (#131665)  
  - Ensure that graph input mutations from the backward remain in the backward graph after partitioning (#129130)

- Dynamic Shapes  
    - Do not generate -1* in SymPy expressions when canonicalising (#128411)  
    - Add FloatPow in the symbolic shape guard closure (#129857)  
    - Add FloatTrueDiv and ToFloat to SYMPY_INTERP (#128418)  
    - Fix symbolic nested int printing (#131916)  

### Cuda

- [CUDA][Pooling] Fix 64-bit indexing in `avg_pool_2d` backward attempt 2 (#129818)  
- fixes (#124582, #128483)  
- Add threadfence to 2-stage reduction for correct writes visibility (#128455)  
- [cuDNN][SDPA] Limit cuDNN SDPA head-dim to 128 (#130494)  
- expose host_emptyCache to python, fix a bug in freeing cudaHostRegist… (#134919)

### Distributed

#### Distributed checkpoint 
- Update _all_gather_keys utils function to derive world size based on input process group. (#135045)  
- Fix non-tensor objects not being loaded correctly during checkpoint loads. (#129398)  
- Fix meta tensors not being loaded during checkpoint loads. (#133256)  
#### c10d
  - Fixed `commSplit` bug by having every rank being called even though it is no-color (#128459)
  - Made sure current device is correct in `torch.distributed.barrier()`'s `streamSynchronize` (#129908)
  - Added flag to control which rank should perform NaN check (#134345)
  - Set correct device to CUDA guards (#134357)
  - Fixed p2p group commsplit (#128803)
  - Fixed corrupt log due to uint_8 printing as char (#130184)
  - Fixed an issue where `ENABLE_INTRA_NODE_COMM=1` + multiple process groups leads to failure (#130269)
  - Fixed an issue where input check fails when running all-reduce on sub groups (#130492)
  - Fixed some issues in two-shot `all-reduce` (#131244)
  - Fixed `split_group` usage when there is a single rank (#131824)
  - Fixed remote address in the `TCPStore` (#131773) (#131913)
  - Fixed a getenv segfault due to a race in getting nccl version (#133744)
  - Changed collective to take in a list of tensors so it work fully for all collectives (#135049)
#### CPU profiler for distributed
  - Fixed input/output dimension overflow (#134360)
#### DSD
  - Disabled 2D state_dict temporarily before the feature is fully ready (#129519)
#### DeviceMesh
  - Fixed replicate with `DeviceMesh` initialization (#133024)
#### DTensor
  - Fixed `foreach_norm` when ord is 2 (#130753)
  - Fixed `_MaskPartial` when multiple embeddings coexist (#131264)
  - Fixed the bug where Sharding Prop cache was wrongly shared among multi-threaded ProcessGroup in tests (#134509)
#### FSDP2
  - Fixed `unshard` without lazy init (#129241)
#### TensorParallel(TP)
  - Fixed `loss_parallel` with BF16 logits (#130550)
#### RPC
  - Fixed Distributed EventList usage (#132448)

### Dynamo

- Do not run default saved tensor hooks during tracing (#123196)  
- Make `.data` mutations invisible to autograd (#131403)  
- Skip frame if `TorchDispatchMode` is enabled (#131828)  
- Ensure `nn_module_stack` is the same when inlining inbuilt `nn.Module`s (#128295)  
- Compiled autograd bug fixes:  
  - use same graph node names as AOTDispatcher (#133148)  
  - match eager behavior for `post_acc_grad_hook`s (#134205) and `ctx.saved_variables` (#134286)  
  - error instead of deadlock on reentrant autograd (#134530)  
  - match eager behavior for inplace detached activations (#134186)  
- `OptimizedModule.training` flag now mirrors the wrapped module. (#131546)  
- Fixes to exception handling (#131795, #131801, #132425)  
- Fix indexing and slicing of ranges (#128567)  
- Create list slices as new local objects (#132912)  
- Handle infinite `map`/`zip` and return `map`/`zip` instead of a tuple (#135074)  
- Guard correctly on tensor subclasses (#130780)  
- Register all entrypoint backends on first attempt to `list_backends` (#132546)  
- Cache attr_proxy for nn_module attribute to fix guard check failure (#130280)

### Export

- Fix unflattener for unused inputs/outputs + `preserve_module_call_signature` (#128260)  
- Preserve `.requires_grad` on FakeTensors in graph metadata (#128656)  
- Handle deduplicated SymInt compute nodes when unflattening (#129153)  
- Handle mutated FakeScriptObject state when reused in `aot_export` (#128844)  
- Fix FakeMode mismatch for joint-graph export API (#129421)  
- Don’t DCE side-effectful custom ops (#129680, #130970)  
- Fix FakeMode detection for 0-input graphs (#129928, #131995)  
- Allow kwargs for training IR (#130553)  
- Fix constants & non-persistent buffers for training IR (#130864)  
- Fix training IR for 0-input graphs (#130990, #133031)  
- Improve output node metadata preservation for strict mode (#131706)  
- Preserve autograd state when lowering to inference IR (#131988)  
- Preserve `source_fn_stack` for training IR (#132033)  
- Preserve `.requires_grad` for unflattened parameters (#134353)  
- Preserve `aten::to` for training IR (#134622)  
- Error out when exporting ScriptModule (#135302)  
- Fix warning for ComposeImplicitAutograd custom ops in pre-dispatch (#130623)  
- fix `node.users` when inlining higher-order-ops (#133144)  
- Improve logging for TSConverter (#132082)  
- Fix serialization of OpOverload with SymInt outputs (#132126)  
- Construct empty graph when there's no tensor computation (#129541)  
- Fix inline_inbuilt_nn_modules + export (#133731)

### ForEach Frontend

- Perform reciprocal optimization with foreach_div (#128433)

### Fx

- Fix index issues in torch.fx.interpreter (#129527)  
- Recursively apply options to print_readable (#130268)  
- Implement deepcopy for Proxy (#133706, #133470)  
- Fix `linearize(grad(...))` call by moving DCE (#133364)  
- Respect find_all setting in sequential mode of minimizer (#134339)

### Jit

- Validate that node TK_ASSIGN have field initialized (#127878)  
- Fixes for LLVM 18 and ASAN (#130661, #133623, #134572)

### Linalg Frontend

- Fix input checks for `linalg.lstsq` (#130612)

### mps

- [MPS] Make erfinv compilable for bfloat16 (#128375)  
- [MPS] Fix Clamp correctness with type promotion (#130226)  
- [MPS] Fix `torch.[all|any]` for 5+D tensors (#130542)  
- [MPS] Store philox counter as part of the RNG state (#130662)  
- [MPS] Min and max NaN propagation fix in MPS backend (#130445)  
- [MPS] Correct nonzero warning and fix the test (#132127)  
- [MPS] Fix SDP training (#134719)  
- [MPS] Fix bachnorm_2d for channels last (#134618)  
- [MPS] Fix NaNs in triu op (#128575)  
- [MPS] Parameterize group_size in int4_mm test, fix int4mm for group_size > 128 (#129628)  
- [MPS] Fix crash when running PyTorch with Metal API validation turned on (#130377)  
- [MPS] LSTM backward kernel workaround on MacOS 14.4+ to fix correctness (#130038)  
- [MPS] Fix masked_fill_ in non_contiguous cases (#131957)  
- [MPS] Fix relu for 0-element input case (#133191)  
- [MPS] Add workaround for nonzero with large/complex inputs  (#126188)  
- [MPS] Enable batch matmul for sizes > 2**32 when tensor can be split along batch axis (#133430)

### nn

- Use newer `toAccumulateType` signature in `Normalization.cpp` (#134540)

### Optim

- Fix accidental change of step signature which affected GradScaler interaction (#129933)  
- Remove an introduced Host & Device Sync In LR Scheduler (#133663)  
- Fall back to slower foreach_add in optim.step() when is_compiling() to avoid untracked tensor during graph tracing (#130909)

### Optimizer Frontend

- [3/N] Enable clang-tidy on torch/csrc/inductor (#132101)

### Profiler

- [Profiler] Fix profiler_kineto Clang errors (#128464)  
- [Profiler] Add Rank to NCCL Debug Info (#129528)  
- [Profiler] Directly use end_ns to create the FunctionEvent instead of using start_ns + duration_ns in pytorch profiler post processing for checking parent-child precisely (#129554)  
- [Profiler] exclude gpu_user_annotation when accumulating cuda time total (#130733)  
- [Memory Snapshot] Make recordAnnotations callback initialize lazily (#129242)  
- [Memory Snapshot] Fix race on alloc_trace vector - S430480 (#130180)  
- [Memory Snapshot] Stop duplicating annotations to all device_traces (#130315)  
- [Profiler] Allow record_function kwargs to be non-string values (#134893)  
- [Profiler] Fix CPU Annotation Overlapping with Python Events (#129599)

### Python Frontend

- Fix Storage.filename to not track the filename when storage was mmap-ed with MAP_PRIVATE (#128725)  
- Fix allowlisting of builtins for weights_only unpickler (#129244)  
- Fix div with rounding_mode="floor" when division overflows (#129536)  
- Fix warning when pickle.load torch.Storage (#130246)  
- Fix dtype mismatch in lobpcg eigen solver (#132762)  
- Prevent an unnecessary device -> host copy for CuPy arrays when not explicitly setting a device in torch.as_tensor.  (#132595)  
- Fix type promotion for torch.`ldexp` (#133519)  
- Fix 0-dim tensor of complex or bool type for torch.aminmax. (#128404)  
- Fix torch.prod vectorized path for bool (#128009)

### Releng

- Fix MacOS double-loading of OpenMP runtime (#129473)  
- Fix exposing statically linked libstdc++ CXX11 ABI symbols in Linux binaries (#137209)  
- Release engineering tooling and CI fixes. Workflows, Trymerge, Bot Labeler, Mergebot (#128840, #129924, #129500, #128924, #129291, #128842, #129720, #129987, #130570, #132681, #133143, #133350, #133372, #133861, #131475, #134047, #134711, #134785, #133869)

### XPU

- Fix xpu nightly wheel test failure (#130742)   
- Fix xpu nightly wheel test env (#134395)   
- Fix test_sgd_weight_decay_xpu accuracy error (#134744)   
- Fix windows xpu build issue (#133845)   
- Fix tensor print behavior for XPU (#130523)   
- Fix overriding default CMAKE_CXX_FLAGS on Windows (#135093)   
- Remove duplicate XPU switch case in DispatchStub (#132480)   
- Keep zero check be compatible with different sympy versions (#130729)   
- Align the appearance of device_put op in fx_graph generated for CUDA and XPU, which is exposed in the issue #130823 (#132479)   
- Fix patch for old llvm package error for triton xpu (#134204)   
- Fix tensor print behavior for XPU (#130523)  
- Fix windows xpu build issue (#133845)  
- Check compilation status before query cudnn version in conv (#135332) 

### Nested-Tensor Frontend

- Default to input tensor device for as_nested_tensor(t) (#130050)  
- Fix SDPA backward for the special case of an NJT with ragged second batch dim and constant length (#128349)

### cuDNN

- [CUDNN][SDPA] Fix unsupported trivial stride-1 transpose case (#134031)  
- Minor bugfix for cuDNN SDPA

### ONNX

- Fix onnx conversion `scaled_dot_product_attention` (#133314)
- Fix `scaled_dot_product_attention` with float scale (#135594)
- Add assertion nodes to ignoring list (#135591)

### ROCm

- [ROCm] CUDA_VISIBLE_DEVICES fallback option for device_count (#129650)
- [ROCm] Return correct AMDSMI socket_power metric   (#130331)
- [ROCm] Check supported archs before setting preferred blas backend to hipblasLT (#128753)

## Performance

### Cuda

- [pytorch][cuda] Generate kernels for 5x5 filters on depth wise convolution backward (#129609)  
- [fp8 rowwise] Retune the tile heuristics to increase perf (#134781)

### Distributed

#### CPU profiler for distributed  
  - Added API for Dynamic Activity Toggling for CPU profiler (#133353)  

### Dynamo

#### Compile time improvements  
  - Manually implement `nn.Module.__getattr__` (#129315)  
  - Manually implement `nn.Module._call_impl` (#129285)  
  - Manually trace `torch.nn.Module.parameters` (#129583)  
  - Optimize guard for small tuples (#130400)  
  - Use dict tags to skip guards on immutable dict `getitem`s (#130654)  
  - Reduce overhead for `PolyfilledFunctionVariable.call_function` (#134842)

### Fx

- Speed up fx graph iteration by implementing it in C++ (#128288)  
- Remove unnecessary `get_implications` calls (#128410)  
- Implement a fast-path to FakeTensor detach (#131899)  
- Optimize `Node.__update_args_kwargs` (#135076)  
- Remove generators in map_aggregate (#135082)  
- Bypass custom `setattr` in `Node.__init__` (#135079)

### Inductor

- [Compile] Add NEON implementation for bf16->fp32 cast (#134297)  
- Remove dtype check/assert for reduction vectorization and support bool for min/max (#132473)  
- Support masked vectorization for the tail_loop for INT8 datatype (#131155)  
- Support vectorization for torch.argmax/min(float/int64_t)-> int64_t in inductor cpp backend (#131016)  
- Optimize aten.cat calls of a repeated element (#132081)  
- Fix mm pad regression - more conservative estimation of plannable inputs (#128909)  
- Void fallback case for custom scan op lowering (#130936)  
- Move bias add to gemm epilogue (#130675)  
- Add B2B-GEMM performance tuning (#130778)  
- Optimize arbitrary N in cpp packed gemm template (#130690)  
- Improve cache blocking with CPU info in the cpp GEM template (#129348)  
- Improve thread blocking heuristics in cpp gemm (#131024)  
- Support k slicing for static shapes in cpp gemm (#130821)  
- Apply compute/comm reordering passes to achieve overlap (#131614)  
- Support pointwise intermediate nodes in B2B-GEMM (#131685)  
- Add lowering for _scaled_mm that autotunes between ATen kernels and Triton kernels (#130422)  
- Save and run post compilation steps within FXGraphCache (#132294)  
- Add vectorization support for doubles in inductor cpp (#131886)  
- Support vectorization for torch.any(bool) -> bool (#132472)  
- Performance, precision, and dependency improvements to B2B-GEMM (#132354)  
- Support use_libdevice_for_f64 for pointwise ops on XPU, align with CUDA. (#132739)  
- Intel GPU Support: Support codegen empty_strided_xpu, align with #118255 (#126678)  
- Move GPU_TYPE(The runtime avaliable gpu type, cuda or xpu) from (#132740)  
- Support _check_triton_bf16_support on XPU. (#132748)  
- Moves intermediary tensors which are constructed on the cpu to XPU when safe, align with CUDA. (#132843)  
- Support masked vectorization for the tail_loop of the 2d tiles kernel (#130724)  
- Improve large bs perf with better cache blocking in cpp gemm (#132729)  
- Add auto-tuning for sparse semi-structured MM operator (#123742)  
- Support vectorization for atomic add (#131314)  
- Skip cudagraph if too many distinct sizes (#131387)  
- Improve sort kernel performance (#131719)  
- Add unbind_stack_to_cat_pass (#132542)  
- support masked vectorization for the tail_loop (#126526)  
- Update unbind_cat_to_view pass to include more complicated cases (#132831)  
- Extend split_stack_to_cats when split and stack have different dims (#133060)  
- Add unbind_stack_to_slices pass (#133420)  
- Improve compile time regression from MemoryDep.normalize (#135070)  
- Reduce memory alloc overhead by allocating local acc once per thread in cpp gemm (#135277)  
- Enable dynamic M for k-slicing in cpp gemm (#133447)  
- Speedup int8-to-float conversion on aarch64 (#132676)  
- Optimizes cache key calculation by memoizing device data for predictable behavior. (#128366)  
- Adjusts backward kernel block sizes for the FlexAttention module. (#128853)  
- Updates template indexing to use broadcasting instead of masks in the FlexAttention module, optimizing performance. (#128938)  
- Evaluates symbolic expressions during the loading of cached entries, preventing unnecessary computations during writes. (#128997)  
- Adds support for BF16 matrix multiplication (micro-gemm) using Advanced Matrix eXtension (AMX) instructions available in Intel processors for performance improvements. (#127195)  
- Optimizes memory use by avoiding the materialization of large sparse matrices during backward passes in conditional execution. (#129043)  
- Enhances autotuning of FlexAttention by passing fake inputs for block sparse entries. (#129915)  
- Reduces unnecessary tensor metadata in the AOTAutogradCache to improve performance. (#128583)  
- Introduces a caching mechanism for precompilation functions to avoid redundant compilation. (#130350)  
- Updates the loop order to occur post-fusion in inductor. (#126254)  
- Ensures that icx built-in math libraries are preloaded in the compilation process. (#134870)  
- Converts addmm to a decomposition operation instead of a fallback for better performance. (#134823)  
- Adds support for vectorization in the tail loop for dynamic shapes in inductor. (#131745)  
- Optimizes template_buffer usage by introducing a local accumulator when the buffer has multiple users. (#135081)  
- Maximizes the use of available bits for BF16/FP16 vectorization in CPU operations. (#126502)  
- Directly sets meta.val for efficient batch fusion during aten operations. (#135078)  
- Improves performance by tuning the INT8 AMX WoQ micro-kernel for CPU. (#134832)  
- Adjusts the tiling factor for lower precision data types (e.g., BF16, FP16) in inductor's C++ backend to optimize performance. (#133830)  
- Enhances cache blocking mechanisms for dynamic matrix multiplications. (#131306)  
- Addresses issues with loop splitting optimizations in the inductor backend. (#135303)  
- Adds improved cache-blocking configurations for dynamic shapes in GEMM operations. (#133538)  
- Optimizes tensor core usage during matrix multiplications in FlexAttention. (#135168)  
- Refactors memory usage patterns in LoopBody to improve efficiency. (#135286)  
- Introduces a fast path for extracting read/write information without requiring full tracing, improving performance. (#135377)  
- Directly uses empty tensors with strides in CUDA graphs during copy operations for efficiency. (#130777)  
- The issue Fix compile time regression by caching get_gpu_type addresses a significant compile time regression in inductor by caching the results of GPU type queries, reducing the need for repetitive calls to nvidia-smi. This leads to substantial performance improvements, particularly for jobs involving collective operations  (#128363)  
- The issue Introduce heuristic for mixed_mm on A100 adds a heuristic for mixed matrix multiplications, specifically for the A100 GPU, significantly improving performance in certain configurations by tuning the heuristic to outperform existing solutions. (#128232)  
- The issue Improve codegen for ops.masked in triton enhances code generation for masked operations in the Triton backend, ensuring better performance and correctness for these operations within the PyTorch inductor. (#128054)  
- The issue Enable shape_padding multiplier adjustment allows for the adjustment of the shape_padding_multiplier value in PT2 to improve query-per-second (QPS) performance based on specific configurations. (#128346)  
- The issue Emit strided block pointer from ModularIndexing and FloorDiv improves the efficiency of indexing in multi-dimensional tensors by emitting block pointers instead of relying on division and modulo operations. This enhancement optimizes performance, especially for workloads involving strided tensor access patterns. (#127342)  
- The issue Make tl.atomic_add relaxed changes the atomic addition operation in Triton to use relaxed memory ordering rather than acquire/release synchronization, improving performance without sacrificing correctness where strict memory synchronization is unnecessary. (#129133)  
- The issue Linear time dead node elimination optimizes the inductor's dead code elimination by ensuring dead nodes are removed in linear time, improving execution efficiency in PyTorch's computation graphs.  (#129082)  
- The issue Add lowering and codegen for aten.sort implements lowering and code generation for aten.sort in PyTorch's inductor, improving the performance of sorting operations by optimizing them for Triton kernels under specific size thresholds. (#128458)  
- The issue Fallback to eager if re-record too many times ensures that if a CUDAGraph re-records a function too frequently (more than cudagraph_max_recording), PyTorch falls back to the eager execution mode, preventing performance degradation from excessive re-recording.(#129349)  
- The issue Reinplacing should ignore copy_ nodes where the mutated argument is not read updates the reinplacing pass in the inductor backend to skip unnecessary clone() operations when the original tensor's value is not needed. This improves performance by avoiding redundant operations, particularly for custom operations and Triton kernels.  (#130866)  
- The issue Avoid `OpOverloadPacket.__getattr__` calls in inductor lowering resolves inefficiencies caused by excessive calls to `__getattr__` during inductor lowering. By avoiding these calls, the patch prevents unnecessary exceptions that slow down compilation, improving overall performance. (#131348)  
- The issue Always realize sigmoid for CPU modifies the inductor backend to ensure that sigmoid is realized in CPU operations, similar to how exp is handled. This update improves performance by preventing repeated computation of exp in nested loops during inference tasks, particularly for models like LLaMA2. (#128339)  
- The issue bf16/fp16 gemm template computed with fp32 reintroduces the GEMM template for mixed-precision computation, allowing bf16 and fp16 values to be computed using fp32 precision in PyTorch's inductor backend. This enhances accuracy and stability for matrix multiplications involving lower precision data types. (#128472)

### mps

- [MPS] GGML inspired int8 MM Metal shader (#127646)  
- [MPS] Fused Adam & AdamW (#127242)  
- [MPS] Fused SGD optimizer (#129350)

### Profiler

- [Profiler] Add TSC Clock Callback to CUPTI (#125036)  
- [Profiler] Only parse kineto requests and build tree when required (#132713)

### Quantization

- Speed up `torch.ops.decomposed.dequantize_per_channel` (#132828)  
- Speed up `torch.ops.decomposed.quantize_per_channel` (#133029)  
- Enable optimized dynamic quantization on aarch64 (#126687)

### cuDNN

- [cuDNN][SDPA] cherrypick Support attn_bias in cuDNN (#130482)  
  - cuDNN SDPA now supports arbitrary fully materialized arbitrary bias (masks)

### Sparse Frontend

- Improve addmm(dense, BSR) performance on specific shapes and GPUs (#132646)

## Documentation

### Autograd frontend

- Improve wording of `torch.inference_mode` documentation (#132321, #130307)  
- Made `torch.autograd.graph.register_multi_grad_hook` return type `RemovableHandle` (#132074)

### Distributed

#### TorchElastic
  - Added docstring for the `torch.distributed.elastic.utils.distributed.get_free_port` function (#128133)
  - Added docstring to `construct_and_record_rdzv_event()` (#128189)
#### c10d
  - Added notes about same sized tensors to `dist.gather()` (#128676)
  - Fixed `DDPLoadBalancingPlanner` docstring (#134044)
  - Cleaned up `distributed/CONTRIBUTING.md` (#128450)
  - Clarified warning for concurrent PG usage (#131895)
  - Fixed typo in docs of `all_gather` (#133066)
  - Add docs for ENV variables `TORCH_NCCL_ASYNC_ERROR_HANDLING`  - `TORCH_NCCL_TRACE_CPP_STACK` and `TORCH_NCCL_COORD_CHECK_MILSEC` (#132920)
#### DeviceMesh
  - Updated slicing documentation to include n-D and non-continuous slicing (#132311)
#### DTensor
  - Improved docs and comments in `DTensor` (#132683, #133149, #133306)
#### Pipelining
  - added small logging section to docs (#129368)

### Dynamo

- Switch out references from old custom ops landing page to new landing page (#129178)  
- Point C++ custom autograd function tracing error to google doc (#134514)  
- Suggest to use `pytree` when graph-break on `optree` (#131827)

### Fx

- Document the torch.fx.annotate.annotate function (#128337)  
- Fix typo in `torch/fx/passes/README.md` (#134078)  
- Add docstring for the torch.fx.operator_schemas.create_type_hint (#128139)  
- Fix link to dynamo in torch/fx readme (#130233)

### Inductor

- Add a 'to' method for moving to and from device for BlockMask (#132087)  
- Update max-autotune documentation for CPU (#134986)  
- Fix typos (#128258, #128587)  
- Improves documentation for block mask creation to better explain its usage and structure. (#130649)x

### jit

- Document torch.jit.frontend.get_jit_class_def method (#128391)  
- Document `torch.jit.frontend.get_default_args` (#128408)  
- Document c10::AliasAnalysisKind::CONSERVATIVE (#130765)

### Linalg Frontend

- Fix a typo in `solve_triangular` and `householder_product` (#129766, #124279)

### mps

- [MPS] Add mps environment variable table (#129008)  
- [MPS] Add mps profiler env vars to docs (#129552)

### nn

- Fix small typo in docstring in `nn.ParameterList` (#129193)  
- Fix the max_norm value in a note for `nn.Embedding` (#129687)  
- Add note on transposed weight initialisations in `nn.init` (#130122)  
- Fix an example for broadcasting error of `attn_bias` and `attn_mask` for `nn.functional.scaled_dot_product_attention` (#130209)  
- Fix example for `convert_conv3d_weight_memory_format` (#131742)  
- Fix doc string for clip_grad_norm_ to (#133406)  
- Fix docs for L1Loss and MSELoss (#133501)

### Optim

- Improve docstrings for Learning Rate Scheduler (#128679, #130306, #132482)  
- Document optim hooks on Optimizer base class  (#131628)  
- Add a reference for the LRScheduler class from main torch.optim doc (#133243)  
- Make optim.swa.util content accessible from the torch.optim doc (#133393)  
- Improve docstrings for Optimizer (#129086, #135384)

### Optimizer Frontend

- [NeuralNetInference] Bring up iOS builds (#131917)

### Profiler

- [Profiler] Document the torch.cuda.profiler.profile function (#128216)  
- [Profiler] Document `torch.cuda.profiler.start` (#128098)

### Python Frontend

- Strip inaccurate either float32 or float64 statement from set_default_type (#128192)  
- Add docstring for the torch.typename function (#128129)  
- Add documentation for automatic mixed precision for xpu backend (#127276)  
- Add example for torch.serialization.add_safe_globals (#129396)  
- Fix rendering of Tensor.module_load doc (#130489)  
- Fix documentation for tensor.repeat. (#131195)  
- Fix rendering of the unicode characters (#134597)  
- Fix documentation for `torch.nn.utils.rnn.pack_padded_sequence` (#135417)  
- Add docstring for the torch.serialization.default_restore_location function (#128132)  
- Update `torch.nanmean` docstring to mention input dtype requirement (#128155)  
- Fix reference to `Multinomial` class in torch.multinomial documentation (#131904)  
- Improve `torch.stack` example code to be reproducible (#133857)

### Releng

- Deleted outdated and misleading info from .ci/pytorch/README.md  (#131502)

### XPU

- Adding a note for Getting Started with PyTorch on Intel GPUs (#127872)   
- Fix requirements.txt installation failure issue on Windows (#136893)   
- Add xpu for amp (#127276)   
- Add xpu to `torch.compile` (#127279)   
- Update amp example to device-agnostic (#127278)   
- Add xpu to `torch.tensors` (#127280)   
- Introduce the concept of Accelerators to PyTorch doc (#129363) 

### Sparse Frontend

- Define **zero-preserving unary functions** (#130804)

### ONNX

- Update fake mode usage in onnx docs (#135512)
- Improve comments (#128083, #128171, #128082)

## Developers

### Distributed

#### c10d
  - Exposed `set_thread_name` to Python and set thread names (#128448)
  - Added better logging for `Socket` and `TCPStore`: (#128673)
  - Fixed pyi annotation for `ProcessGroupNCCL.Options` (#130957)
  - Added `dump_traceback` handler for Control Plane (#128904)
  - Added logs of whenever we sleep in `ProcessGroupNCCL` (#129197)
  - Introduced a util for detecting DMA connectivity among devices (#129510)
  - Surfaced better error message on 0 bytes (#130056)
  - Logged port on error inside `TCPStoreLibUvBackend` (#130797)
  - Added a warning messages in the comment about cuda hang (#130844)
  - Changed to LOG error rather than info in device check (#131483)
  - Add better logging on wait timeout in `TCPStore` (#131808)
  - Fixed pyi annotation for `ProcessGroupGloo.Options` (#132080)
  - Added a new API for adding ephemeral timeout for one local rank and the timeout will reset when the first collective finishes (#130905)
  - Use `pg_id` instead of `pg_name` for logging prefix (#132058)
  - Added space between PG ID and PG UID (#133497)
  - Control logging of c++ traces with a flag in `ProcessGroupNCCL` (#133490)
  - Made NCCL PG error messages more accurate and simpler (#134017, #134036)
  - Used wait counters instead in `TCPStore` (#135283)
  - Switched LOG level from ERROR to WARNING for `TCPStore` get failure (#134349)
#### DTensor
  - Included meshes in cross-mesh error msg (#130454)
  - Added `dtensor` to `TORCH_LOGS` (#129512)
#### FDSP
  - Removed spammy logs in `_runtime_utils.py` (#129967)
#### FDSP2
  - Added `TORCH_LOGS=+fsdp` to log hooks(pre/post forward/backward) and FQN (_init_fqns) (#128663)
#### DSD
  - Captured reader, writer and planner components in the DCP API logger (#129548)
#### TorchElastic
  - Fixed torchrun log message (#131652)
  - Fixed stdout / stderr typing in `SubprocessHandler` (#132071)
  - Added warning when users try to pass a `use_libuv` argument to `create_c10d_store` (#135062)

### Fx

- Add bits16 to graph dtype_abbrs (#130339)

### Optim

- Add `__all__` to torch.optim to define public interface (#131959)  
- Remove circular import coming from torch.optim._multi_tensor (#128875)

### Optimizer Frontend

- [pytorch][counters] DynamicCounter (#132166)

### Releng

- Better Engineering, Ruff lint improvements, better error messages (#130199, #133200, #129374, #129809, #129752, #129753, #131547, #130139)

### XPU

- Change conda to miniforge for xpu images (#134455)   
- Enable python 3.13 for xpu nightly build (#133670)   
- Update xpu cd used driver to rolling version (#133454)    
- Change xpu nightly build back to ABI=0 (#132854)   
- Disable xpu kineto build (#133069)    
- Change xpu ci build runner type to reduce build time (#130922)   
- Add pytorch xpu wheel build in nightly (#129560)    
- Add triton xpu wheel build (#129730)    
- Disable Kineto PTI on Windows only (#134620)   
- Update Intel Triton to release/2.5.0 (#134074)    
- Use larger instance for building triton whl (#135201)   
- Set make triton install pre-built whl by default (#130313)    
- Add `xpu_cmake_macros.h` to xpu build (#132847)

### ONNX

- Remove beartype usage (#130484)

## Security

### Inductor

- relax unification checks when size-like symbols can be 0 (#133112)

### Linalg Frontend

- Force inconsistent-missing-override for torch targets (#130010)

### Optimizer Frontend

- [torch][take2] Implement BFloat16 `__hip_bfloat16` overloads (#132234)

### Quantization

- Hipify Pytorch3D (#133343)
