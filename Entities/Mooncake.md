---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Mooncake

Moonshot AI's LLM inference system; KV-cache-centric serving architecture; named in the Survey of LLM Inference Systems.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Provides zero-copy transfer, multi-NIC pooling, link optimization, and elastic scaling that enables SGLang's PD/EPD separation and distributed KVCache sharing. Presented at 智算技术沙龙 (2026-01-31) alongside KTransformers (AVX/AMX-based CPU/GPU heterogeneous inference, native NVFP4/FP8/BF16 MoE kernels). — [[2026-02-10-线上观看人次18万-智算技术沙龙圆满落幕-附-ppt-下载]]
- Alibaba Cloud Beluga-KVCache (CXL-based, arXiv:2511.20172) benchmarks directly against Mooncake (RDMA-based): in cache-hit scenario Beluga reduces average TTFT by 89.6% and improves QPS by 7.35×; in PD-disaggregated deployment QPS improves 3.41×–9.47×. MoonCake struggles with small (16-token) KV blocks (TTFT 76.8s vs 13.0s at 256-token blocks), whereas Beluga uses vLLM native 16-token blocks without batching overhead. — [[2025-12-10-较mooncake首token延迟直降89-6-阿里云提出基于cxl的kv缓存管]]
- Seer (Moonshot AI) builds a cross-instance global KV Cache Pool on Mooncake using a DRAM/SSD two-tier architecture for RL rollout divided requests; the pool proactively prefetches KV cache to the target instance based on Request Buffer queue information and releases it after rollout completion. — [[2026-01-04-moonshot-seer-长度感知-分段处理-投机采样-97-吞吐提升]]
