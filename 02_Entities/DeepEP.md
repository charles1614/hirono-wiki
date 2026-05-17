---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 24
tier: active
---

# DeepEP

DeepSeek's open-source MoE expert-parallelism communication library (dispatch/combine All-to-All kernels via NVLink + RDMA)

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[DeepEP]] 是 DeepSeek 开源的 MoE EP 专用通信库，提供高吞吐 Kernel（训练/Prefill，节点内 NVLink+节点间 RDMA）和低时延 Kernel（Decoding，纯 RDMA，借助 IBGDA 绕过 CPU 代理线程），原生支持 FP8 通信，在 H800 集群测试中各项带宽均接近物理极限。 — [[2025-10-09-deepseek-开源系列之-deepep-介绍]]
- 高吞吐 Kernel 采用 warp specialization，默认 20 SM 分 10 通信信道（偶数 Block 发送，奇数接收），SM 数量可灵活配置；低时延 Kernel 通过 Receiving Hook 接口让 RDMA 传输在另一 Micro-Batch 计算期间异步执行，不占用任何计算 SM。 — [[2025-10-09-deepseek-开源系列之-deepep-介绍]]
- [[DeepEP]] Internode::dispatch 高吞吐 Kernel 使用 5 类 warp 角色（kRDMASender、kRDMASenderCoordinator、kRDMAAndNVLForwarder、kForwarderCoordinator、kNVLReceivers）协同完成 IB→NVLink 跨节点转发；低时延 Dispatch/Combine 各有 4 类角色；代码中使用了文档外 PTX 指令和特殊 Memory Order 保证，并修改了 NVSHMEM 库。 — [[2025-10-09-分析一下ep并行和deepseek开源的deepep代码]]
- 在 RoCE 网络上运行 [[DeepEP]] 面临四大挑战：Multi-Rail/Rail-Only 拓扑兼容性差、AlltoAll incast 长尾延迟、RC 模式适配、In-Network Computing 缺失；[[SGLang]] 目前在 RoCE 环境下用 AllGather+AllReduce 替代 AlltoAll 以绕开这些问题，通信量更大但实测更稳定。 — [[2025-10-09-分析一下ep并行和deepseek开源的deepep代码]]
- Tencent Taiji team used TRMT (Tencent Network team's communication library) instead of DeepEP for their 15,800+ tokens/s H20 result; TRMT is adapted for int4-quantized models and reduced EP communication timeline from 40%+ to ~16% of total wall time (60% reduction). DeepEP is listed as a future optimization target for further communication speedup. — [[2025-08-18-腾讯太极团队实现deepseek模型业内h20最高性能15800-tokens-]]
- Low-latency mode: two-phase (send/recv) CUDA kernel using NVSHMEM IBGDA for single-sided RDMA; pre-allocated buffers eliminate metadata sync; IBGDA latency ~64 µs vs IBRC 128–256 µs for <8 KiB messages; optional FP8 quantization on send reduces data 50%; two modes: `recv_hook=false` (single kernel, overlappable) vs `recv_hook=true` (send+recv split ~10 µs each). — [[2025-10-09-xzwazsg-zjcksvuvksvw]]
- Source-code walkthrough: three communication modes (intranode NVLink, internode RDMA, low-latency RDMA+AR); intranode uses NVLink peer memory access via virtual addressing without cudaMallocManaged; internode dispatch via `nvshmem_int_put_nbi`; IB Virtual Lanes for traffic isolation; AR supported only on low-latency kernel. — [[2025-10-09-deepseek-deepep源码分析]]
- Alibaba [[RTP-LLM]] integrated DeepEP for PD-disaggregated [[DeepSeek-V3]] inference on RoCE; Low Latency mode latency reduced 60%+ with dual-uplink load-balancing patches; Combine phase is ~2× longer than Dispatch (FP16 vs FP8 transfer), requiring asymmetric overlap budget. — [[2025-10-09-如何重现-deepseek-推理性能突破]]
- [[NVSHMEM]] IBRC transport underpins DeepEP's expert dispatch: one-sided RMA put/get replace NCCL's two-sided send/recv; AMO (`IBV_WR_ATOMIC_FETCH_AND_ADD`) on the single per-PE QP provides synchronization; NVSHMEM IBRC is distinct from [[IBGDA]] (IBRC uses CPU proxy for doorbell; IBGDA has GPU SM write doorbell directly). — [[2025-05-27-谈谈deepep中的nvshmem]]
