---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 1
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

- ByteDance veRoCE RDMA protocol (December 2025): fixes two RoCEv2 root problems — PFC dependence and no multi-path support — via native multi-path (entropy modification + packet spraying), DDP for out-of-order delivery on all verb types, SACK-based selective retransmission, and per-path congestion control. In 128 GPU clusters: LLM training speed +11.2%, AlltoAll throughput +48.4%, 95.7% effective bandwidth at 2% loss vs RoCEv2 complete failure. Hardware partners: [[NVIDIA]], [[AMD]], [[Broadcom]], 云脉芯联, 比特智路; 400G/800G/1.6T NIC support in progressive rollout. — [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]]

## Sources drawn on

- [[2025-12-19-火山引擎-force-大会发布-veroce-传输协议]] — ByteDance veRoCE RDMA protocol announcement: multi-path, DDP, SACK retransmission, per-path congestion control; 128 GPU cluster benchmarks; hardware partner list.
