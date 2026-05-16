---
created: 2026-05-11
updated: 2026-05-16
type: entity
refs: 21
tier: active
---

# NVLink

NVIDIA's high-bandwidth GPU-to-GPU interconnect; current gen (NVLink 5) ~1.8 TB/s; defines the NVLink domain for inference disaggregation.

## Synthesis

*Regenerated from Observations below.*

## Observations

- NVLink-C2C variant connects [[Vera CPU]] to [[Rubin]] GPU at 1.8 TB/s coherent bandwidth — 7× PCIe Gen 6; enables CPU-GPU cache coherence within the Vera Rubin NVL72 platform, removing PCIe as the CPU-side orchestration bottleneck for agentic AI workloads. — [[2026-03-17-nvidia-launches-vera-cpu-purpose-built-f]]
- Vera Rubin NVL72 ships NVLink 6 switches providing 3.6 TB/s all-to-all scale-up bandwidth per GPU; full rack delivers 260 TB/s NVLink bandwidth; NVLink-C2C provides 1.8 TB/s coherent CPU-GPU bandwidth within the [[Rubin]] Superchip (2 GPUs + 1 Vera CPU per Superchip = 100 PFLOPS NVFP4 + 576 GB HBM4). — [[2026-01-26-nvidia-vera-rubin-nvl72-co-designed-infr]]
- In GB200 weight offloading v2: NVLink-C2C CPU-GPU interconnect minimizes weight onload latency vs. PCIe, making async prefetch of offloaded weights viable with near-zero throughput loss; enables prefill of DeepSeek-R1 with every other MoE GEMM weight offloaded to CPU while maintaining full compute saturation. — [[2026-02-05-在-blackwell-上推动-vllm-wide-ep-与大规模推理走向成熟-]]
- NCCL LL128 protocol exploits NVLink's 128-byte atomicity: 120B data + 8B flag per transfer unit achieves ~95% peak NVLink bandwidth at low latency; LL128 is disabled on PCIe-only systems lacking guaranteed 128-byte atomic write ordering. — [[2025-08-16-nccl发布论文啦-快来看看-part-1]]
- NCCL 2.27 symmetric memory targets intra-node NVLink domains: maps identical virtual address layouts across all local ranks via CUDA VMM, enabling peer GPU memory reads at near-physical-limit latency on NVL72 and DGX-H100 (NVL8); inter-node symmetric memory via IBGDA is planned. — [[2025-08-14-让nccl性能起飞的nccl-symmetric-memory是啥黑科技-par]]
- NVLink SHARP (NVLS) AllReduce achieves 480 GiB/s busbw vs 363 GiB/s without NVLS on 8×H100, while per-GPU NVLink bandwidth drops from 170–190 to 100–130 GiB/s — the busbw gain comes from NVSwitch offloading the reduce via broadcast/reduce rather than GPU-to-GPU ring exchange. — [[2025-08-16-聊聊-gpu-监控那些事-利用率-故障等]]
- PyTorch Symmetric Memory (2.9 experimental) exposes NVLink virtual address mapping so custom GPU kernels can directly read/write peer HBM; one-shot all-reduce via NVLS multicast achieves ~500 GB/s on 8×H100 for 1 GB tensors, outperforming NCCL; fused all-gather + matmul Triton kernel delivers 1.3–1.5× speedup on Llama-70B scale. — [[2025-11-09-pytorch-symmetric-memory-解锁-nvlink-可编程性的]]
- NCCL LL128 protocol specifically targets NVLink's guaranteed 128-byte atomic write capability (120B data + 8B flag); achieves ~95% peak NVLink bandwidth at ~2 µs/hop; disabled automatically on PCIe-only systems that cannot guarantee atomic 128B write ordering. NCCL NVLS algorithm uses NVLink SHARP to offload AllReduce onto NVSwitch, achieving 480 GiB/s vs 363 GiB/s ring AllReduce. — [[2025-08-18-从rtx-6000和cx8的一个小问题-聊一下gpu的传输]]
- [[DeepEP]] 高吞吐 Kernel 在 H800 环境（NVLink 单向实测 ~160 GB/s = 400 GB/s × 80% / 2）节点内通过 NVLink+NVSwitch 通信，节点间通过 IB（50 GB/s）；IB 为 NVLink 带宽的 1/3.2，高吞吐 Kernel 要求关闭 IB 自适应路由以避免死锁。 — [[2025-10-09-deepseek-开源系列之-deepep-介绍]]
- NCCL 2.19.1 intra-node transport: NVLink P2P → PCIe P2P → SHM (host-memory relay); P2P_DIRECT mode (same-process ranks) skips IPC handle creation and FIFO buffers, using direct pointer arithmetic, reducing latency significantly. LL128 protocol exploits NVLink's 128B atomic granularity. — [[2025-08-03-nccl揭秘-一-协议与传输]]
- Generational progression at GTC 2026: NVLink-2 (Volta/V100) → NVLink-3 (Ampere/A100) → NVLink-4 (Hopper/H100) → NVLink-5 ([[Blackwell]]/B200, 1.8TB/s, 130TB/s NVLink Spine) → NVLink-6 (Rubin, 3.6TB/s per GPU) → NVLink-7 (Rubin Ultra, same 3.6TB/s but more ports) → NVLink-8 CPO (Feynman). — [[2026-03-18-nvidia-gtc2026-详细解读和分析]]
