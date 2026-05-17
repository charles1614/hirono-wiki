---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://chipsandcheese.com/p/chinas-newish-sw26010-pro-supercomputer-at-sc23
tags: [hardware-architecture, hpc, gpu-microarchitecture, systems]
---

# [2023-11-20] China's SW26010-Pro Supercomputer at SC23 (Chips and Cheese)

## TL;DR

A detailed microarchitecture analysis of Sunway's SW26010-Pro processor (2020–21 era) and the supercomputer built around it, concluding that the design prioritizes peak FP64 throughput over memory bandwidth and cache hierarchy, producing a system that outperforms Fugaku in theory but requires heroic programmer effort and remains severely memory-bound.

## Key claims

- [[SW26010-Pro]] has 6 Core Groups (CGs) vs. SW26010's 4; each CG has 64 CPEs on a 4×4 mesh plus one MPE for management — 384 CPEs total per chip.
- Memory: 16 GB DDR4 per cluster (96 GB total) with dual-channel DDR4-3200 — 307.2 GB/s aggregate bandwidth; roughly the same bandwidth as a contemporary desktop (Ryzen 3950X).
- Compute: vector width doubled to 512 bits; clock increased from 1.45 GHz to 2.25 GHz; per-chip FP64 throughput more than quadruples over the prior generation.
- Memory bandwidth to compute ratio is 0.11 bytes/FP32-FLOP — about half the ratio of a consumer RX 6900 XT, with no HBM and no large on-chip L2 cache (CPEs have only 256 KB software-managed scratchpad, configurable as up to 128 KB cache).
- Networking: the supercomputer has 107,136 chips (41.1M CPEs total); 256-node supernodes with ~2.7 TB/s uplink each; per-node global bandwidth ~10.54 GB/s vs. Fugaku's 34 GB/s — large problems scale worse on Sunway.
- Achieving high network utilization required a research paper-worthy optimization (Rongfen Lin et al.) to spread HPL-MxP blocks across NUMA nodes via single-MPI-process pseudo-distributed mode; comparable effort unnecessary on Frontier or Fugaku.
- Authors argue the design is optimized for TOP500 rankings (FP64 HPL score) rather than practical scientific throughput, and call for future Sunway chips to include HBM and a real cache hierarchy.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[SW26010-Pro]]

## Topics touched

[[HPC Architecture]], [[GPU Microarchitecture]], [[GPU Cluster Networking]]

## Raw source

[chipsandcheese.com/p/chinas-newish-sw26010-pro-supercomputer-at-sc23](https://chipsandcheese.com/p/chinas-newish-sw26010-pro-supercomputer-at-sc23) — Chester Lam and George Cozma, Chips and Cheese, 2023-11-20. Read 2026-05-16.
