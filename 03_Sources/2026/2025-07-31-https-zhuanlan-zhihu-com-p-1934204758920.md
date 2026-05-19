---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://zhuanlan.zhihu.com/p/1934204758920524842?share_code=1e5gtVF2jkaaB&utm_psn=1934506872888620382
tags: [inference, disaggregation, parallelism, tooling]
---

# [2025-08-01] StepMesh：面向 AF 分离系统的通信库

## TL;DR

阶跃星辰 (StepFun) publishes a detailed technical blog on [[StepMesh]], the GPUDirect RDMA communication library they built for Attention-FFN disaggregated (AFD) inference in Step-3. The post covers the 273 µs bipartite communication constraint derivation, timeline design with per-microbatch GPU streams, straggler detection/mitigation, and the rationale for choosing CPU-only IBRC over IBGDA and [[BytePS]] over [[NCCL]].

## Key claims

- AFD latency constraint: for 20 tokens/s SLA with 61-layer Step-3 and a 3-stage 1A1F pipeline, each A2F + F2A round trip must complete in ≤273 µs per microbatch.
- Communication data volumes per FFN GPU (2A2F, batch=128, hidden=7168): A2F = 2×128×7168×1 B (FP8) → 161.3 Gbps effective bandwidth needed in 91 µs; F2A = 2×128×7168×2 B (BF16) → 161.3 Gbps in 182 µs; combined 273 µs.
- Design: A2F tensors (tokens + expert distribution) are RDMA-written from Attention to all FFN instances, which then RDMA-write F2A activations directly back to pre-registered Attention buffers — eliminating intermediate rendezvous.
- Timeline: different microbatches use separate GPU streams enabling overlap; FFN AllGather from prior microbatch overlaps with current microbatch FFN compute.
- [[StepMesh]] chose [[BytePS]] as base (not [[NCCL]]) for four reasons: NCCL lacks native bipartite graph communication; NCCL's dedicated communication SMs compete with compute in AFD's strict compute-communication overlap; NCCL has no reliable MxN latency guarantees per MegaScale-Infer benchmarks; NCCL is NVIDIA-only.
- CPU-only IBRC chosen over IBGDA (used by DeepEP/Triton-distributed) because: 2A2F payload sizes (896 KB A2F, 1.75 MB F2A) make CPU control-plane latency negligible at 400 Gbps; IBGDA's SM occupancy conflicts with compute-bound FFN; CPU affinity isolation + `isolcpus` reduces TPOT jitter to ~5 ms in 2A2F.
- Straggler detection: StepMesh embeds nanosecond timestamps in RDMA packet metadata (red timestamps in traces), allowing Attention-side attribution of slowdowns to network, FFN CPU, FFN GPU/NVLink, or Attention CPU/GPU from a single measurement point without cross-node clock synchronization.
- Current TPOT min–mean gap is ~2 ms, traced primarily to jitter from `ibv_poll_cq`, `cudaEventQuery`, and `cudaLaunchKernel` — root cause in hardware/driver, not yet fully resolved.

## Visual observations

- `https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920/zhihu-img-001.jpg` — 1A1F 3-stage pipeline diagram with communication constraint derivation timeline.
- `https://hirono-wiki.litenext.digital/raindrop/zhuanlan.zhihu.com/2025-07-31-https-zhuanlan-zhihu-com-p-1934204758920/zhihu-img-003.jpg` — StepMesh 3-stage timeline showing per-microbatch GPU stream overlap.

*Other images decorative — monitoring dashboard screenshot and flow diagram described fully in body.*

## What this changes

Provides a concrete implementation reference for sub-300 µs bipartite AF communication at production scale, including the cost model justifying CPU-only RDMA control over GPU-side IBGDA.

## Entities touched

[[StepMesh]], [[BytePS]], [[NCCL]], [[FSDP]], [[NVLink]]

## Topics touched

[[AF Disaggregation]], [[Inference Disaggregation]], [[GPU Cluster Networking]], [[Communication-Computation Overlap]]

## Raw source

[zhuanlan.zhihu.com/p/1934204758920524842](https://zhuanlan.zhihu.com/p/1934204758920524842?share_code=1e5gtVF2jkaaB&utm_psn=1934506872888620382) — Zhihu article, 阶跃星辰开放平台, Aug 1 2025. Read 2026-05-15.
