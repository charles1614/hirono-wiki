---
created: 2026-05-11
updated: 2026-05-16
synthesis_updated_at: 2026-05-13T00:00:00.000Z
type: entity
refs: 34
tier: active
---

# CUDA

NVIDIA's GPU programming platform — language extensions, runtime, toolkit, libraries.

## Synthesis


NVIDIA's GPU programming platform — language extensions, runtime, toolkit, and libraries — received its largest update since launch with CUDA 13.1 (December 2025). The headline addition is CUDA Tile, a new programming model above SIMT that lets developers write tile-level algorithm operations and have the compiler map them to threads, Tensor Cores, and future GPU architectures; it ships today as cuTile Python (with a C++ implementation planned) targeting Ampere, Ada, and Blackwell. Supporting the Tile model, Nsight Compute 2025.4 adds a dedicated Tile Statistics profiling surface — launch configuration, TMA utilization, and cuTile source mapping — while Compute Sanitizer 2025.4 gains compile-time patching via nvcc for faster, more precise memory-error detection. The release also promotes green contexts from the driver API to the runtime API for flexible SM partitioning, introduces MLOPart on Blackwell B200/B300 for memory-locality optimization, adds static SM partitioning for MPS, and carries forward cuBLAS FP32/FP64 emulation on Tensor Cores from CUDA 13.0. The CUDA programming guide was rewritten end-to-end, signaling that NVIDIA expects Tile programming to substantially broaden the developer audience.


## Observations

- 以1024×1024矩阵乘法为例：原始GEMM（BlockDim 16×16）因A矩阵非合并访问（每次跨4096字节），全局内存ld事务达1.677亿次；引入共享内存Tiling后降至838万次（5%），全局读数据量从5GB降至0.25GB；通过[[Neutrino]] PTX插桩验证Average Running Time从190,207→106,999 cycles；TILE_SIZE 32→16进一步将bank conflict从62.8万降至16.6万次，与cuBLAS量级相当。 — [[2025-09-10-迈向可编程观测-在gpu-kernel中构建类ebpf风格的性能探针]]
- CUDA 13.1 (Dec 2025) introduces a substantial platform refresh: **CUDA Tile** programming model (Tile IR + cuTile Python) targeting "above SIMT" kernel authoring with compiler-managed Tensor-Core mapping; **green contexts** moved from driver API to runtime API (with customizable `split()` for SM partitioning); **MLOPart** for Blackwell memory-locality partitioning; cuBLAS FP32/FP64 Tensor-Core emulation; Nsight Compute 2025.4 Tile profiling; Compute Sanitizer compile-time patching. Programming guide rewritten end-to-end. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
- Profiling support for CUDA workloads uses CUPTI (CUDA Profiling Tools Interface) — the mechanism behind [[Nsight Systems]]' CUDA Runtime/Driver API trace and GPU timeline. CUDA 10.0+ is the floor for most platforms; Arm SBSA requires 10.2+. Driver and toolkit must be paired per the published compatibility table. — [[2025-08-18-installation-guide-nsight-systems]]
- CUDA-L2 (arXiv:2512.02551) demonstrates that LLM-generated CUDA kernels improve significantly with staged leveled prompting: Level 0 (correct), Level 1 (memory — tiling + shared memory), Level 2 (compute — warp + tensor cores), with level-appropriate learnable feedback, outperforming GPT-4o on HPC benchmarks without any reference code. — [[2026-03-12-你的-llm-写-cuda-还停留在-level-0-吗-小红书]]
- Three official CUDA container image variants cover distinct use cases: `base` (libcudart only — run pre-compiled binaries), `runtime` (base + cuBLAS/cuDNN — inference/training), `devel` (runtime + nvcc + headers — build custom CUDA operators); `libcuda.so` is always injected by [[NVIDIA]] Container Toolkit at runtime and must never be installed in the container image itself. — [[2026-01-20-nvidia-gpu-容器环境-原理与构建指南]]
- Compute Capability (CC) defines the hardware features and supported instructions per GPU architecture: CC 9.0 = Hopper (H100/H200/GH200), CC 10.0 = [[Blackwell]] (GB200/B200), CC 10.3 = GB300/B300, CC 12.0 = RTX PRO Blackwell / GeForce RTX 5090–5050, CC 12.1 = GB10 (DGX Spark). Programs must be compiled for the target CC to use architecture-specific instructions such as `tcgen05.mma`. — [[2026-01-15-nvidia-cuda-gpu-compute-capability]]
- User-triggered GPU core dump via CUDA driver named pipe (`CUDA_ENABLE_USER_TRIGGERED_COREDUMP=1`, `CUDA_COREDUMP_PIPE`) enables capturing hung-kernel state without killing the process; writing 1 MB of zeros to the pipe triggers the dump. The pipe path is discoverable via `/proc/<pid>/fd/`. Requires `NVCC_PREPEND_FLAGS=-lineinfo` + `nvdisasm -ndf -c -gi` on the extracted cubin to get the full multi-level inline call chain beyond what `cuda-gdb` alone shows. — [[2025-12-04-从gpu卡死到精准锁定出错代码-vllm-cuda-调试实战技巧]]
- CUDA VMM (Virtual Memory Management, introduced CUDA 10.2) powers NCCL 2.27 symmetric memory: `cuMemAddressReserve` + `cuMemCreate` + `cuMemMap` decouples VA from physical allocation, enabling each rank to export its buffer handle, distribute via allgather, import peer handles, and map them at a deterministic offset in a shared VA layout; `cuMemSetAccess` grants per-region P2P access, replacing the less granular `cudaDeviceEnablePeerAccess`. — [[2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par]]
- H100上向量化load/store（`LDG.E.128`/`STG.E.128`）与非向量化（`LDG.E`/`STG.E`）的SASS对比：使用 `float4` 的向量化kernel每条指令传输128位而非32位，对N=1<<30的向量复制任务可将所需block数从1,048,576减至262,144，指令数相同但总调度开销降低75%；SASS代码可通过Godbolt（`-arch sm_90`）或NCU工具获取。 — [[2025-05-27-通过查看gpu-assembly分析cuda程序]]
- [[PyTorch]] 的CUDA Runtime/Driver API调用分层：Python层通过 `torch._C` 绑定（`_cuda_getDeviceCount`/`_cuda_setDevice`/`_cuda_synchronize` 等）→ C++层封装cudaXXX/cuXXX → 延迟初始化策略（`_lazy_init`）保证首次使用CUDA时才驱动初始化；[[OpenAI Triton]] 的 `GPUDriver` 复用PyTorch CUDA API进行设备/流管理，JIT编译后通过 `cudaLaunchKernel` launch kernel。 — [[2025-05-27-pytorch-triton与runtime的三角虐恋]]
