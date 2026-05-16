---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://mp.weixin.qq.com/s/blvPFSLhp0wIPfi8tiRJgQ
tags: [training, parallelism, comm-overlap, paper]
---

# [2025-09-01] NCCL揭秘(二)——通信pipeline分析

## TL;DR

Deep technical walkthrough of NCCL's internal communication pipeline: algorithm/protocol selection, communication primitives, channel-based data iteration, P2P scheduling, and the mapping of channels and slots onto CUDA's Grid/Block/Warp/Thread hierarchy.

## Key claims

- NCCL v2.19 supports 6 algorithms (Ring, Tree, CollNet Direct, CollNet Chain, NVLS, NVLS Tree) and 3 protocols (Simple, LL, LL128), but only a subset applies to each of 5 collective operations; Ring and Tree are the broadly representative algorithms while CollNet/NVLS depend on SHARP-capable or NVSwitch hardware.
- CollNet Direct allows every GPU in a node to send directly via NIC (using GPUDirect RDMA), bypassing the single "network lead" GPU used by original CollNet; CollNet Chain uses a strict point-to-point serial-forwarding topology to avoid hot-spots on non-full-mesh networks.
- NCCL decomposes data into channels (each handled by one CUDA Block); within each channel, a fixed-size buffer is divided into 8 slots (NCCL_STEPS) so pipeline overlap is achieved between transmit and reduce/copy across concurrent slots.
- Protocol choice in P2P: Small messages use LL (low-latency), large messages use Simple; LL128 is not used for P2P because its 128B alignment and warm-up costs require large contiguous blocks that P2P cannot reliably supply.
- stepSize = buffSizes[protocol] / NCCL_STEPS; for LL Simple (4 MB / 8 = 512 KB) vs LL (64 KB / 8 = 8 KB). chunkSize is further reduced when actual payload is smaller, enabling finer-grained pipeline parallelism; chunkDataSize = chunkSize/2 for LL to account for interleaved command+data format.
- Channel count in P2P: single-node uses smaller minPartSize (stepSize/8) and larger maxPartSize (stepSize×32) to exploit low NVLink latency; multi-node uses stepSize/2–stepSize range to avoid excessive small network packets.
- CUDA mapping: one channel = one Block; channelMask (not sequential blockIdx.x) maps Blocks to non-consecutive channel IDs; within a Block, Warp 0 loads comm metadata, Warp 1 loads channel metadata, remaining Warps execute data movement; slot-level pipeline lets different Warps progress different pipeline stages simultaneously.

## Visual observations

![](../../raw/raindrop/mp.weixin.qq.com/2025-09-01-nccl揭秘-二-通信pipeline分析/weixin-img-001.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-01-nccl揭秘-二-通信pipeline分析/weixin-img-002.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-01-nccl揭秘-二-通信pipeline分析/weixin-img-005.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-01-nccl揭秘-二-通信pipeline分析/weixin-img-013.png)
![](../../raw/raindrop/mp.weixin.qq.com/2025-09-01-nccl揭秘-二-通信pipeline分析/weixin-img-016.png)

*Other images decorative — code screenshots already quoted inline in body text.*

## What this changes

Provides implementation-level grounding for NCCL's pipeline model: the stepSize/chunkSize/chunkDataSize hierarchy plus channelMask/Warp-role assignments explain performance tuning knobs and per-algorithm behavior differences.

## Entities touched

[[NCCL]], [[NVSwitch]], [[NVLink]]

## Topics touched

[[GPU Cluster Networking]], [[Communication-Computation Overlap]]

## Raw source

[mp.weixin.qq.com/s/blvPFSLhp0wIPfi8tiRJgQ](https://mp.weixin.qq.com/s/blvPFSLhp0wIPfi8tiRJgQ) — WeChat public account "网络虚拟化技术", 2025-09-01. Read 2026-05-16.
