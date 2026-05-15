---
created: 2026-05-15
updated: 2026-05-15
type: entity
refs: 1
tier: seen
---

# InfiniBand

High-speed interconnect fabric used in GPU cluster scale-out networking

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- JAX Scaling Book (Ch. 12): InfiniBand NDR fat-tree in the reference DGX SuperPod provides full bisection bandwidth (400 GB/s/GPU) beyond the NVLink node. 8-GPU nodes connect via 8 CX7 NICs (400 Gbps each); 32-node Scalable Units share 8 leaf IB switches (64-port NDR, 2× the bandwidth of NVSwitches); 4 SUs in a 1024-GPU SuperPod connect via 16 spine IB switches. The fat-tree topology guarantees roughly constant AllReduce bandwidth at scale-out. — [[2025-12-11-how-to-think-about-gpus-how-to-scale-you]]
