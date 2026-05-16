---
created: 2026-05-15
updated: 2026-05-16
type: topic
source_count: 20
---

# GPU Cluster Networking

## What

High-performance interconnects and protocols (RDMA, RoCE, InfiniBand) for large-scale GPU cluster communication in AI training workloads

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

- Will veRoCE adopt broader industry standardization or remain ByteDance-internal?
- How does veRoCE interact with congestion-sensitive collective operations in NCCL beyond AlltoAll?

## Observations

- JAX Scaling Book Ch. 12 provides a complete GPU networking reference: intra-node NVLink (Hopper: 18×25 GB/s = 450 GB/s/GPU; Blackwell: 18×50 GB/s = 900 GB/s; GB200 NVL72 domain up to 72 GPUs); inter-node fat-tree InfiniBand NDR at 400 GB/s/GPU providing full bisection bandwidth; reference 1024-GPU H100 SuperPod uses 32 leaf + 16 spine IB switches. Key numbers: 8×H100 node bisection bandwidth 3.6 TB/s; AllGather 512 MB takes ~1 ms on NVLink; inter-node IB bandwidth ~1/9 of intra-node NVLink. — [[2025-12-11-how-to-think-about-gpus-how-to-scale-you]]
- ByteDance veRoCE RDMA protocol (December 2025): fixes two RoCEv2 root problems — PFC dependence and no multi-path support — via native multi-path (entropy modification + packet spraying), DDP for out-of-order delivery on all verb types, SACK-based selective retransmission, and per-path congestion control. In 128 GPU clusters: LLM training speed +11.2%, AlltoAll throughput +48.4%, 95.7% effective bandwidth at 2% loss vs RoCEv2 complete failure. Hardware partners: [[NVIDIA]], [[AMD]], [[Broadcom]], 云脉芯联, 比特智路; 400G/800G/1.6T NIC support in progressive rollout. — [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]]
- 百度混合云在 3.2 万卡跨园区集群中实现跨园区 RDMA 长传方案：自研高缓存交换机 + 优化 RDMA 协议保障长距离无损传输；端侧多平面组网将二层单 POD 规模从 8000 卡扩展至最大 13 万卡；路由聚合将 POD 内路由数压缩至 4000 条；主机侧自适应路由逐包哈希使吞吐较逐流哈希提升 20%，链路切换可达秒级。 — [[2025-09-16-超大规模-ai-基础设施建设实践-极致释放算力效能]]
- NCCL IB Verbs transport: two RC QPs per rank pair — Forward QP for RDMA_WRITE bulk data + RDMA_WRITE_WITH_IMM completion signal; Reverse QP for CTS control (remote buffer addr + rkey + tag); default 2 logical channels per remote GPU per NIC for ECMP path diversity; GPUDirect RDMA (GDRDMA) enabled when GPU and NIC share the same PCIe switch, routing NIC DMA directly to GPU HBM without CPU staging. — [[2025-08-16-nccl发布论文啦-快来看看-part-1]]
- NCCL three protocols deep dive: Simple (~6 µs/hop, memory-fence sync, large messages), LL (~1 µs/hop, flag-based 4B+4B atomic, 25–50% BW, no RDMA), LL128 (~2 µs/hop, 120B+8B atomics, ~95% BW, NVLink only). Intra-node: NVLink P2P → PCIe P2P → SHM; P2P_DIRECT skips IPC handles for same-process ranks. Inter-node: IB Verbs + flush QP (self-RDMA_READ for PCIe write ordering). RTX 6000+CX8 architecture: all intra-cluster communication routes through 400G NIC at up to 50 GB/s/GPU. — [[2025-08-18-从rtx-6000和cx8的一个小问题-聊一下gpu的传输]]
- `nccl_ib_test.sh` tool: auto-detects IB vs. RoCE, configures NCCL env vars, runs distributed AllReduce test (Ring AllReduce, theoretical transfer = 2×(N-1)/N × data), generates latency+throughput report. — [[2025-08-17-nccl-infiniband-测试验证工具说明文档]]
- NCCL 2.19.1 channel architecture: each channel = independent CUDA block on distinct SM; channels partition input buffer for parallel throughput; `calcP2pChannelCount` reduces nChannels for small messages to avoid under-filling 512 KiB NIC FIFOs; LL protocol requires host DRAM buffers (not GPU memory) since CPU polling GPU memory over PCIe is 10× slower. — [[2025-08-03-nccl揭秘-一-协议与传输]]
- StepMesh (阶跃星辰, AF disaggregation): for Step-3 (61 layers, 2A2F, batch=128, hidden=7168), A2F round trip requires 161.3 Gbps effective throughput in 273 µs; chosen over NCCL and IBGDA for zero SM occupancy and bipartite communication pattern; CPU core affinity + `isolcpus` reduces TPOT jitter to ~5 ms. — [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]]
- [[DeepEP]] NVSHMEM IBGDA for small-message All-to-All decode: ~64 µs vs IBRC 128–256 µs for <8 KiB; uses IB Virtual Lanes (VL) for traffic isolation — Normal kernel workloads, Low Latency kernel workloads, and other traffic must use separate VLs to avoid deadlock/corruption; Adaptive Routing supported only for Low Latency kernel. — [[2025-10-09-deepseek-deepep源码分析]]
- Alibaba [[RTP-LLM]] RoCE dual-uplink fix for [[DeepEP]]: message-level load balancing for Normal kernel (large messages) + queue-level for Low Latency kernel (small messages) via NVSHMEM-layer patches; Low Latency mode latency reduced 60%+ vs unpatched; communication pattern optimization (rack-level flow alignment) avoids intra-cluster traffic collisions. — [[2025-10-09-如何重现-deepseek-推理性能突破]]
- NCCL 2.26.3-1 path computation (`ncclTopoComputePaths`): BFS from each GPU/NIC/NVSwitch builds optimal path table; PXN proxy routing injects intermediate GPU hops via `addInterStep` to avoid Spine Switch traffic (rail-level optimization); NVLink Sharp (NVLS, NCCL_ALGO=NVSL) requires nvidia-fabricmanager and is only supported on Hopper (H100) NVSwitch from NCCL 2.17+; GDR-disabled paths are forced to route through CPU. — [[2025-05-30-nccl-系列之深入解析-nccl-通信路径计算和优化]]

## Sources drawn on

- [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]] — ByteDance veRoCE RDMA protocol announcement: multi-path, DDP, SACK retransmission, per-path congestion control; 128 GPU cluster benchmarks; hardware partner list.
- [[2025-08-03-nccl揭秘-一-协议与传输]] — NCCL 2.19.1 internals: channel architecture, Simple/LL/LL128 protocols, intra-node P2P/SHM, inter-node IB Verbs with QP layout and GDR flush QP.
- [[2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920]] — StepMesh: bipartite AF disaggregation communication, 273 µs SLA derivation, CPU-only IBRC vs IBGDA tradeoffs, straggler telemetry.
- [[2025-07-04-china-s-new-ish-sw26010-pro-supercompute]] — Sunway supercomputer network topology: 256-node supernodes with ~2.7 TB/s uplink; fat-tree to central switch with 48 ports/supernode; per-node global bandwidth ~10.54 GB/s vs Fugaku's 34 GB/s; bandwidth-bound HPL-MxP optimization required distributing sub-blocks across NUMA nodes.
- [[Meta]] SIGCOMM 2024 [[RoCEv2]] AI训练网络：Grand Teton（H100）平台，单平面Spine-Leaf拓扑；路由演进ECMP→E-ECMP（AllReduce +40%）→集中式TE（CSPF+精确匹配表覆盖默认路由）；传输层放弃DCQCN改用集合通信库层CTS接收端准入控制；带宽收敛比最终降至1:1.125。 — [[2025-05-27-meta基于rocev2构建的大规模ai网络]]
