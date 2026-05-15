---
created: 2026-05-12
updated: 2026-05-15
type: entity
refs: 20
tier: active
---

# NCCL

NVIDIA Collective Communications Library — standard GPU-to-GPU collective primitive implementations (AllReduce, AllGather, ReduceScatter, etc.).

## Observations

- _(stub — populate as sources reference this entity. Reindex will count refs and may promote to active tier at ≥3.)_
- ByteDance's veRoCE protocol is positioned as an alternative transport layer beneath NCCL-level collectives: veRoCE fixes RoCEv2's PFC dependence and lack of multi-path support, enabling AlltoAll communication (used by NCCL for MoE expert dispatch) to achieve ~48.4% higher throughput in 128 GPU clusters. — [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]]
- NCCL 2.19.1 paper "Demystifying NCCL" documents its 3-protocol system: Simple (max BW, memory-fence sync, large messages), LL (flag-based 4B+4B atomic, 25–50% peak BW, latency-optimized), and LL128 (128B atomic unit, ~95% peak BW on NVLink); runtime tuning model selects algorithm–protocol based on topology, message size, and bandwidth. — [[2025-08-16-nccl发布论文啦-快来看看-part-1]]
- NCCL's IB Verbs transport uses two RC QPs per rank pair — Forward QP for bulk RDMA_WRITE + RDMA_WRITE_WITH_IMM and Reverse QP for CTS control signals; loop-back RDMA_READ to a dedicated Flush QP efficiently drains PCIe writes into GPU memory by exploiting RDMA ordering semantics (READ must follow prior WRITEs). — [[2025-08-16-nccl发布论文啦-快来看看-part-1]]
- NCCL 2.27 symmetric memory creates a shared virtual address space across local ranks via CUDA VMM: each rank's buffer is accessible at `baseUCSymPtr + rankID * baseStride + offset` by all local ranks, enabling direct pointer arithmetic without IPC handle overhead; `nccl-tests -R 2` confirms near-physical-limit small-message latency on NVL72 and DGX-H100. — [[2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par]]
- nvidia-fabricmanager kill (via OOM) on H100 causes NCCL AllReduce hangs because NCCL defaults to NVLS algorithm (NVLink Sharp); setting `NCCL_ALGO=Ring` or restarting fabricmanager resolves the hang, as documented in NCCL GitHub issue #976. — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]
- NCCL three-protocol deep dive: Simple uses memory-fence sync (~6 µs/hop, near-peak BW); LL uses flag-based 4B+4B atomic sync (~1 µs/hop, 25–50% BW, no GPUDirect RDMA); LL128 uses 120B+8B atomics (~2 µs/hop, ~95% BW, requires atomic 128B writes — auto-disabled on PCIe). Intra-node: NVLink P2P preferred, then PCIe P2P, then SHM (host-memory relay for cross-socket). P2P_DIRECT mode (same-process ranks) skips IPC handles and FIFO buffers. Inter-node: IB Verbs with GPUDirect RDMA when GPU and NIC share PCIe switch; flush QP (self-directed RDMA_READ) enforces PCIe write ordering. — [[2025-08-18-从rtx-6000和cx8的一个小问题-聊一下gpu的传输]]
- `nccl_ib_test.sh` is an open-source shell tool for validating NCCL over IB/RoCE: 4 modes (env/test/report/all), auto-detects native-IB vs. RoCE, runs distributed AllReduce with Ring AllReduce (theoretical transfer = 2×(N-1)/N × data), and generates latency+throughput+error reports. — [[2025-08-17-nccl-infiniband-测试验证工具说明文档]]
- [[NCCL]] 的核心竞争力在于软硬件协同：初始化时完成全拓扑发现（NVLink/NVSwitch/IB 带宽延迟图）+ 多并行逻辑通道预建 + 算法/协议预选，确保后续调用快速响应；Ring AllReduce 两阶段各 N-1 步，通信量约 2× 数据大小；国产通信库（HCCL、BKCL、CNCL、MCCL、ICCL）的真正挑战在于缺乏 NVLink/NVSwitch 级互联生态。 — [[2025-10-05-解析nccl的技术原理与生态-探讨国产gpu的通信库方向]]
- NCCL 2.19.1 architecture deep-dive: channel = independent CUDA block per SM, buffer partitioned across channels; `calcP2pChannelCount` reduces nChannels for small messages to avoid under-filling 512 KiB NIC FIFOs; double-binary-tree topology for large messages uses mirror + offset for even/odd node counts. LL protocol implementation: `st.volatile.global.v4.u32` stores 4B data + 4B flag atomically in `storeLL`; receiver busy-polls with `ld.volatile.global.v4.u32` until both flag copies match in `readLL`. — [[2025-08-03-nccl揭秘-一-协议与传输]]
- StepFun explicitly rejected NCCL for Step-3 AF disaggregated inference: no native bipartite graph communication; dedicated communication SM occupancy competes with compute in AFD; unreliable MxN low-latency performance (per MegaScale-Infer benchmarks); NVIDIA-GPU-only. Chose [[BytePS]]-based [[StepMesh]] instead. — [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]]
